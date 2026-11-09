import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bumpSize, SPHERE_RADIUS } from '../data/format'
import { BG_HEX, genreTint, pastel } from '../lib/theme'
import { useAtlas } from '../store/atlas'
import { useReducedMotion } from '../hooks/useReducedMotion'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Every book is a low-poly clay dome sitting on the sphere, plus a flat contact
 * disc offset toward the light so clusters read as raised terrain. Base matrices
 * are written once per dataset; selection and hover only touch colours or the
 * single hovered matrix, so nothing rebuilds 2,000 instances on a click.
 */
export default function BookInstances() {
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const alphas = useAtlas((state) => state.alphas)
  const alphaVersion = useAtlas((state) => state.alphaVersion)
  const selectedId = useAtlas((state) => state.selectedId)
  const hoveredId = useAtlas((state) => state.hoveredId)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const shadowRef = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((state) => state.invalidate)
  const reduced = useReducedMotion()

  // A squashed closed sphere reads as a soft clay lens; an open hemisphere
  // shows a hard dark rim at this size, which made every dot look like a ring.
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 16, 10), [])
  const discGeometry = useMemo(() => new THREE.CircleGeometry(1, 12), [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.78,
        metalness: 0,
      }),
    [],
  )

  const discMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#46526E',
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
      }),
    [],
  )

  /** Base matrices are kept so hover/reveal can scale without recomputing TRS. */
  const baseMatrices = useRef<Float32Array | null>(null)
  const previousAlphas = useRef<Uint8Array | null>(null)
  const previousSelected = useRef<number | null>(null)
  const reveal = useRef({ startedAt: 0, running: false })
  const hover = useRef({ id: -1, scale: 1 })
  const hovered = useRef<number | null>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    const shadows = shadowRef.current
    if (!mesh || !shadows || !points || !count) return

    const matrix = new THREE.Matrix4()
    const dummy = new THREE.Object3D()
    const unit = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const tangentA = new THREE.Vector3()
    const tangentB = new THREE.Vector3()
    const origin = new THREE.Vector3()

    const needsBase = baseMatrices.current?.length !== count * 16
    if (needsBase) baseMatrices.current = new Float32Array(count * 16)

    const colour = new THREE.Color()
    const background = new THREE.Color(BG_HEX)

    for (let i = 0; i < count; i++) {
      const x = points.positions[i * 3]
      const y = points.positions[i * 3 + 1]
      const z = points.positions[i * 3 + 2]
      const length = Math.hypot(x, y, z) || 1
      unit.set(x / length, y / length, z / length)

      const bump = bumpSize(points.attrs.popularity[i])
      const grow = (selectedId === i ? 1.22 : 1) * (0.94 + 0.06 * (alphas[i] ?? 255) / 255)

      quaternion.setFromUnitVectors(UP, unit)
      origin.copy(unit).multiplyScalar(SPHERE_RADIUS * 1.001)
      dummy.position.copy(origin)
      dummy.quaternion.copy(quaternion)
      dummy.scale.set(bump.radius * grow, bump.height * grow * 2.1, bump.radius * grow)
      dummy.updateMatrix()
      matrix.copy(dummy.matrix)

      if (needsBase) {
        matrix.toArray(baseMatrices.current!, i * 16)

        // Contact shadow: a flat disc in the tangent plane, nudged toward the
        // lower-right of the dome so light appears to come from the top-left.
        tangentA.set(-unit.y, unit.x, 0)
        if (tangentA.lengthSq() < 1e-4) tangentA.set(1, 0, 0)
        tangentA.normalize()
        tangentB.crossVectors(unit, tangentA).normalize()
        dummy.position
          .copy(origin)
          .addScaledVector(unit, bump.radius * 0.001)
          .addScaledVector(tangentA, bump.radius * 0.58)
          .addScaledVector(tangentB, -bump.radius * 0.46)
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit)
        const shadowScale = bump.radius * 1.1
        dummy.scale.set(shadowScale, shadowScale * 1.6, 1)
        dummy.updateMatrix()
        shadows.setMatrixAt(i, dummy.matrix)
      }

      const dim = 1 - (alphas[i] ?? 255) / 255
      colour.set(pastel(genreTint(points.attrs.genre[i]), 0.85))
      colour.lerp(background, dim * 0.62)
      mesh.setColorAt(i, colour)
    }

    mesh.instanceMatrix.array.set(baseMatrices.current!.subarray(0, count * 16))
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (needsBase) {
      shadows.instanceMatrix.needsUpdate = true
      shadows.frustumCulled = false
    }

    mesh.count = count
    mesh.frustumCulled = false
    shadows.count = count
    mesh.computeBoundingSphere()

    previousAlphas.current = new Uint8Array(alphas.subarray(0, count))
    previousSelected.current = selectedId

    if (needsBase && !reduced) {
      reveal.current = { startedAt: performance.now(), running: true }
      if (import.meta.env.DEV) {
        console.info(
          `[atlas] books=${count} domes=16x10 sphereRadius=${SPHERE_RADIUS} ` +
            `contactShadows=${count}`,
        )
      }
    }

    invalidate()
  }, [points, count, alphas, alphaVersion, selectedId, reduced, invalidate])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh || !baseMatrices.current || !count) return
    const step = Math.min(delta, 0.08)
    let dirty = false

    // Bloom-in: every dome grows from zero with a per-book delay.
    if (reveal.current.running) {
      const elapsed = (performance.now() - reveal.current.startedAt) / 1000
      const array = mesh.instanceMatrix.array as Float32Array
      for (let i = 0; i < count; i++) {
        const delay = ((i * 2654435761) % 1000) / 1000 * 0.55
        const t = THREE.MathUtils.clamp((elapsed - delay) / 0.85, 0, 1)
        if (t >= 1) continue
        const eased = 1 - Math.pow(1 - t, 3)
        const offset = i * 16
        for (let col = 0; col < 3; col++) {
          array[offset + col * 4] = baseMatrices.current[offset + col * 4] * eased
          array[offset + col * 4 + 1] = baseMatrices.current[offset + col * 4 + 1] * eased
          array[offset + col * 4 + 2] = baseMatrices.current[offset + col * 4 + 2] * eased
        }
        dirty = true
      }
      if (elapsed > 1.6) {
        reveal.current.running = false
        ;(mesh.instanceMatrix.array as Float32Array).set(baseMatrices.current)
        dirty = true
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true
      invalidate()
    }

    // Hover: one dome springs to 1.5x, the previous one falls back.
    const target = hoveredId ?? null
    if (target !== hovered.current) {
      if (hovered.current != null) {
        const offset = hovered.current * 16
        ;(mesh.instanceMatrix.array as Float32Array).set(
          baseMatrices.current.subarray(offset, offset + 16),
          offset,
        )
      }
      hovered.current = target
      hover.current = { id: target ?? -1, scale: 1 }
      if (target == null) {
        mesh.instanceMatrix.needsUpdate = true
        invalidate()
      }
    }
    if (target != null && target < count) {
      const goal = 1.5
      const k = 1 - Math.exp(-step / 0.11)
      hover.current.scale += (goal - hover.current.scale) * k
      const s = hover.current.scale
      const offset = target * 16
      const array = mesh.instanceMatrix.array as Float32Array
      for (let col = 0; col < 3; col++) {
        array[offset + col * 4] = baseMatrices.current[offset + col * 4] * s
        array[offset + col * 4 + 1] = baseMatrices.current[offset + col * 4 + 1] * s
        array[offset + col * 4 + 2] = baseMatrices.current[offset + col * 4 + 2] * s
      }
      mesh.instanceMatrix.needsUpdate = true
      invalidate()
    }
    void alphas
    void alphaVersion
    void previousAlphas
    void previousSelected
  })

  if (!points || !count) return null

  return (
    <>
      <instancedMesh
        ref={shadowRef}
        args={[discGeometry, discMaterial, count]}
        frustumCulled={false}
        renderOrder={0}
      />
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, count]}
        frustumCulled={false}
        renderOrder={1}
      />
    </>
  )
}
