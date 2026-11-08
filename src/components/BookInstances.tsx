import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bumpSize, SPHERE_RADIUS } from '../data/format'
import { useAtlas } from '../store/atlas'
import { hexToRgb } from '../lib/color'

const UP = new THREE.Vector3(0, 1, 0)

const POINT_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute vec3 aNormal;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * aNormal);
    float facing = dot(n, normalize(-mv.xyz));
    vColor = aColor;
    vAlpha = aAlpha;
    if (facing < 0.02) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / -mv.z, 1.4, 44.0);
  }
`

const POINT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float light = clamp(0.78 - (c.x * 1.15 + c.y * 1.05), 0.40, 1.05);
    float shade = 1.0 - pow(d, 2.2) * 0.26;
    vec3 col = vColor * (0.84 + 0.24 * light) * shade;
    float alpha = (1.0 - smoothstep(0.82, 1.0, d)) * vAlpha;
    gl_FragColor = vec4(col, alpha);
  }
`

/**
 * Every book is one instance of a low-poly clay dome. When zoomed out the same
 * data is drawn as shaded point sprites, and the dome mesh is swapped back in
 * once the camera is close enough for the geometry to read.
 */
export default function BookInstances() {
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const clusters = useAtlas((state) => state.clusters)
  const clusterOf = useAtlas((state) => state.clusterOf)
  const alphas = useAtlas((state) => state.alphas)
  const alphaVersion = useAtlas((state) => state.alphaVersion)
  const invalidate = useThree((state) => state.invalidate)
  const size = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)

  const domeRef = useRef<THREE.InstancedMesh>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const pointsMode = useRef(false)
  const pointMaterial = useRef<THREE.ShaderMaterial | null>(null)

  const domeGeometry = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    geometry.setAttribute(
      'aAlpha',
      new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count)).fill(1), 1),
    )
    return geometry
  }, [count])

  const domeMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    })
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;\nvarying float vFacing;',
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;')
        .replace(
          '#include <defaultnormal_vertex>',
          '#include <defaultnormal_vertex>\nvFacing = transformedNormal.z;',
        )
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nif (vFacing < -0.02) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);',
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\ngl_FragColor.a *= vAlpha;',
        )
    }
    material.customProgramCacheKey = () => 'clay-book-bump'
    return material
  }, [])

  const instanceMatrices = useMemo(() => {
    if (!points) return null
    const matrices = new Float32Array(count * 16)
    const position = new THREE.Vector3()
    const unit = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const matrix = new THREE.Matrix4()

    for (let i = 0; i < count; i++) {
      const x = points.positions[i * 3]
      const y = points.positions[i * 3 + 1]
      const z = points.positions[i * 3 + 2]
      const length = Math.hypot(x, y, z) || 1
      unit.set(x / length, y / length, z / length)
      const bump = bumpSize(points.attrs.popularity[i])
      quaternion.setFromUnitVectors(UP, unit)
      position.copy(unit).multiplyScalar(SPHERE_RADIUS * length)
      scale.set(bump.radius, bump.height, bump.radius)
      matrix.compose(position, quaternion, scale)
      matrix.toArray(matrices, i * 16)
    }
    return matrices
  }, [points, count])

  const instanceColors = useMemo(() => {
    if (!points || !clusterOf) return null
    const colors = new Float32Array(count * 3)
    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const cluster = clusters[clusterOf[i]]
      color.set(cluster?.color ?? '#c9d1dd')
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    return colors
  }, [points, clusterOf, clusters, count])

  const spriteGeometry = useMemo(() => {
    if (!points || !clusterOf) return null
    const centres = new Float32Array(count * 3)
    const normals = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const alpha = new Float32Array(count).fill(1)

    for (let i = 0; i < count; i++) {
      const x = points.positions[i * 3]
      const y = points.positions[i * 3 + 1]
      const z = points.positions[i * 3 + 2]
      const length = Math.hypot(x, y, z) || 1
      centres[i * 3] = x
      centres[i * 3 + 1] = y
      centres[i * 3 + 2] = z
      normals[i * 3] = x / length
      normals[i * 3 + 1] = y / length
      normals[i * 3 + 2] = z / length
      sizes[i] = bumpSize(points.attrs.popularity[i]).radius * SPHERE_RADIUS * 2.6
      const [r, g, b] = hexToRgb(clusters[clusterOf[i]]?.color ?? '#c9d1dd')
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(centres, 3))
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SPHERE_RADIUS * 1.2)
    return geometry
  }, [points, clusterOf, clusters, count])

  const pointMaterialObject = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 900 } },
        vertexShader: POINT_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  )

  useLayoutEffect(() => {
    pointMaterial.current = pointMaterialObject
  }, [pointMaterialObject])

  // Instance transforms + colours only change when the dataset does.
  useLayoutEffect(() => {
    const mesh = domeRef.current
    if (!mesh || !instanceMatrices || !instanceColors) return
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
      matrix.fromArray(instanceMatrices, i * 16)
      mesh.setMatrixAt(i, matrix)
      color.setRGB(
        instanceColors[i * 3],
        instanceColors[i * 3 + 1],
        instanceColors[i * 3 + 2],
      )
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [instanceMatrices, instanceColors, count, invalidate])

  // Search / filter dimming is a per-instance alpha attribute; no scene reload.
  useEffect(() => {
    if (!count) return
    const domeAttribute = domeGeometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute
    const spriteAttribute = spriteGeometry?.getAttribute('aAlpha') as
      | THREE.BufferAttribute
      | undefined
    const domeValues = domeAttribute.array as Float32Array
    const spriteValues = spriteAttribute?.array as Float32Array | undefined
    for (let i = 0; i < count; i++) {
      const value = alphas[i] / 255
      domeValues[i] = value
      if (spriteValues) spriteValues[i] = value
    }
    domeAttribute.needsUpdate = true
    if (spriteAttribute) spriteAttribute.needsUpdate = true
    invalidate()
  }, [alphas, alphaVersion, count, domeGeometry, spriteGeometry, invalidate])

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const height = size.height * dpr
    pointMaterialObject.uniforms.uScale.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360))
    invalidate()
  }, [size, camera, pointMaterialObject, invalidate])

  useFrame(({ camera: frameCamera, invalidate: refresh }) => {
    const domes = domeRef.current
    const sprites = pointsRef.current
    if (!domes || !sprites) return
    const distance = frameCamera.position.length()
    const next = pointsMode.current ? distance > 4.7 : distance > 5.15
    if (next !== pointsMode.current) {
      pointsMode.current = next
      domes.visible = !next
      sprites.visible = next
      refresh()
    }
  })

  if (!points || !count) return null

  return (
    <group>
      <instancedMesh
        ref={domeRef}
        args={[domeGeometry, domeMaterial, count]}
        frustumCulled={false}
        renderOrder={2}
      />
      {spriteGeometry ? (
        <points
          ref={pointsRef}
          geometry={spriteGeometry}
          material={pointMaterialObject}
          frustumCulled={false}
          renderOrder={2}
          visible={false}
        />
      ) : null}
    </group>
  )
}
