import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { atlasView } from '../lib/view'
import { useAtlas } from '../store/atlas'

const VERTEX = /* glsl */ `
  attribute vec3 aNormal;
  varying float vFacing;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * aNormal);
    vFacing = dot(n, normalize(-mv.xyz));
    gl_Position = projectionMatrix * mv;
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  varying float vFacing;

  void main() {
    if (vFacing < 0.02) discard;
    float horizon = smoothstep(0.02, 0.4, vFacing);
    gl_FragColor = vec4(uColor, 0.10 * uFade * horizon);
  }
`

/**
 * Every book joined to its two nearest neighbours in one LineSegments draw
 * call. Back-facing threads are discarded in the vertex shader and the whole
 * layer fades in once the camera is zoomed past the detail threshold.
 */
export default function AmbientThreads() {
  const points = useAtlas((state) => state.points)
  const showLinks = useAtlas((state) => state.showLinks)
  const invalidate = useThree((state) => state.invalidate)
  const fade = useRef(0)

  const geometry = useMemo(() => {
    if (!points) return null
    const count = points.positions.length / 3
    const k = Math.max(1, Math.round(points.neighbors.length / Math.max(1, count)))
    const perBook = Math.min(2, k)
    const positions = new Float32Array(count * perBook * 2 * 3)
    const normals = new Float32Array(count * perBook * 2 * 3)

    const write = (offset: number, id: number) => {
      const x = points.positions[id * 3]
      const y = points.positions[id * 3 + 1]
      const z = points.positions[id * 3 + 2]
      const length = Math.hypot(x, y, z) || 1
      const nx = x / length
      const ny = y / length
      const nz = z / length
      positions[offset] = nx * SPHERE_RADIUS * 1.002
      positions[offset + 1] = ny * SPHERE_RADIUS * 1.002
      positions[offset + 2] = nz * SPHERE_RADIUS * 1.002
      normals[offset] = nx
      normals[offset + 1] = ny
      normals[offset + 2] = nz
    }

    for (let i = 0; i < count; i++) {
      for (let j = 0; j < perBook; j++) {
        const neighbour = points.neighbors[i * k + j]
        if (neighbour == null || neighbour < 0 || neighbour >= count) continue
        const base = (i * perBook + j) * 6
        write(base, i)
        write(base + 3, neighbour)
      }
    }

    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3))
    buffer.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SPHERE_RADIUS * 3)
    return buffer
  }, [points])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#6F7C8E') },
          uFade: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => () => geometry?.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const target = showLinks && atlasView.zoom > 1.55 ? 1 : 0
    const previous = fade.current
    fade.current += (target - previous) * Math.min(1, delta * 6)
    if (Math.abs(fade.current - previous) < 0.001) fade.current = target
    material.uniforms.uFade.value = fade.current
    if (fade.current !== previous) invalidate()
  })

  if (!geometry) return null

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
    />
  )
}
