import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { genreTint } from '../lib/theme'
import { useAtlas } from '../store/atlas'
import { useReducedMotion } from '../hooks/useReducedMotion'

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;
  attribute float aId;

  uniform float uScale;
  uniform float uDpr;
  uniform float uHover;
  uniform float uReveal;

  varying vec3 vColor;
  varying float vState;
  varying float vFade;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 normal = normalize(normalMatrix * normalize(position));
    float facing = dot(normal, normalize(-mv.xyz));

    float stateSize = 1.0;
    if (aState > 2.5) stateSize = 0.8;
    else if (aState > 1.5) stateSize = 1.9;
    else if (aState > 0.5) stateSize = 1.4;

    float base = mix(1.25, 2.1, aSize);
    base *= 1.0 + step(abs(aId - uHover), 0.5) * 0.5;

    // Screen-sized points: constant clay pebbles at any camera distance.
    float size = clamp(base * stateSize * uScale / max(0.001, -mv.z), 5.0, 16.0) * uDpr;
    if (facing < -0.05) size = 0.0;

    gl_PointSize = size;
    gl_Position = projectionMatrix * mv;

    vFade = smoothstep(-0.05, 0.28, facing) * uReveal;
    vColor = aColor;
    vState = aState;
  }
`

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vState;
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0) discard;

    float radius = sqrt(r2);
    float edge = smoothstep(1.0, 0.88, radius);

    vec3 n = vec3(uv.x, -uv.y, sqrt(max(0.0, 1.0 - r2)));
    vec3 lightDir = normalize(vec3(-0.5, 0.6, 0.62));
    float diffuse = max(dot(n, lightDir), 0.0);
    float spec = pow(max(dot(reflect(-lightDir, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
    float rim = smoothstep(0.5, 1.0, n.x * -0.45 + n.y * 0.7 + 0.25);

    vec3 base = vColor;
    float alpha = vFade * edge;

    if (vState > 2.5) {
      base = mix(base, vec3(0.73, 0.75, 0.79), 0.5);
      alpha *= 0.22;
    }

    vec3 colour = base * (0.74 + 0.55 * diffuse) + vec3(0.3) * spec;
    colour += rim * 0.14;
    colour *= mix(0.9, 1.0, smoothstep(0.82, 1.0, radius));

    gl_FragColor = vec4(colour, alpha);
  }
`

const STATE_NORMAL = 0
const STATE_NEIGHBOUR = 1
const STATE_SELECTED = 2
const STATE_DIMMED = 3

/**
 * All books in one THREE.Points draw call with a shaded-sphere impostor.
 * Point size is clamped in screen space, so zooming keeps 5–16px pebbles
 * instead of cones that merge into clutter. Selection changes touch only the
 * affected state values.
 */
export default function BookDots() {
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const alphas = useAtlas((state) => state.alphas)
  const alphaVersion = useAtlas((state) => state.alphaVersion)
  const selectedId = useAtlas((state) => state.selectedId)
  const hoveredId = useAtlas((state) => state.hoveredId)
  const nearby = useAtlas((state) => state.nearby)
  const reduced = useReducedMotion()
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  const invalidate = useThree((state) => state.invalidate)

  const states = useRef<Uint8Array | null>(null)
  const reveal = useRef(0)

  const geometry = useMemo(() => {
    if (!points) return null
    const total = points.positions.length / 3
    const positions = new Float32Array(total * 3)
    const colours = new Float32Array(total * 3)
    const sizes = new Float32Array(total)
    const ids = new Float32Array(total)
    const colour = new THREE.Color()

    for (let i = 0; i < total; i++) {
      const x = points.positions[i * 3]
      const y = points.positions[i * 3 + 1]
      const z = points.positions[i * 3 + 2]
      const length = Math.hypot(x, y, z) || 1
      positions[i * 3] = (x / length) * SPHERE_RADIUS * 1.003
      positions[i * 3 + 1] = (y / length) * SPHERE_RADIUS * 1.003
      positions[i * 3 + 2] = (z / length) * SPHERE_RADIUS * 1.003

      colour.set(genreTint(points.attrs.genre[i]))
      const jitter = (((i * 2654435761) % 1000) / 1000 - 0.5) * 0.12
      colour.offsetHSL(0, 0.02, jitter)
      colours[i * 3] = colour.r
      colours[i * 3 + 1] = colour.g
      colours[i * 3 + 2] = colour.b

      sizes[i] = points.attrs.popularity[i] / 255
      ids[i] = i
    }

    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('aColor', new THREE.BufferAttribute(colours, 3))
    buffer.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    buffer.setAttribute('aState', new THREE.BufferAttribute(new Uint8Array(total), 1))
    buffer.setAttribute('aId', new THREE.BufferAttribute(ids, 1))
    buffer.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SPHERE_RADIUS * 1.2)
    return buffer
  }, [points])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uScale: { value: 54 },
          uDpr: { value: 1 },
          uHover: { value: -1 },
          uReveal: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  )

  useEffect(() => () => geometry?.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useLayoutEffect(() => {
    if (!geometry) return
    material.uniforms.uScale.value = 54 * (size.height / 640)
    material.uniforms.uDpr.value = Math.min(2, dpr)
    invalidate()
  }, [geometry, material, size.height, dpr, invalidate])

  useLayoutEffect(() => {
    if (!geometry || !count) return
    const attribute = geometry.getAttribute('aState') as THREE.BufferAttribute
    const next = states.current?.length === count ? states.current : new Uint8Array(count)
    states.current = next
    const neighbours = new Set(nearby)

    let first = count
    let last = -1
    for (let i = 0; i < count; i++) {
      let state = STATE_NORMAL
      if (i === selectedId) state = STATE_SELECTED
      else if (neighbours.has(i)) state = STATE_NEIGHBOUR
      // A selection dims everything that is not part of the relationship graph.
      else if (selectedId != null || (alphas[i] ?? 255) < 128) state = STATE_DIMMED
      if (next[i] === state) continue
      next[i] = state
      first = Math.min(first, i)
      last = Math.max(last, i)
    }

    if (last >= 0) {
      const array = attribute.array as Uint8Array
      array.set(next)
      attribute.needsUpdate = true
      attribute.addUpdateRange(first, last - first + 1)
      invalidate()
    }
  }, [geometry, count, selectedId, nearby, alphas, alphaVersion, invalidate])

  useFrame((_, delta) => {
    const goalReveal = reduced ? 1 : Math.min(1, reveal.current + delta / 1.4)
    reveal.current = goalReveal
    material.uniforms.uReveal.value = goalReveal

    const goalHover = hoveredId != null ? hoveredId : -1
    if (material.uniforms.uHover.value !== goalHover) {
      material.uniforms.uHover.value = goalHover
      invalidate()
    }
    if (reveal.current < 1) invalidate()
  })

  if (!geometry) return null

  return (
    <points geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
  )
}
