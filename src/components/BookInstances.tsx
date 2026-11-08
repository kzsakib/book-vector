import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bumpSize, SPHERE_RADIUS } from '../data/format'
import { useAtlas } from '../store/atlas'
import { BG_HEX, genreTint } from '../lib/theme'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * One InstancedMesh for every book: a low-poly clay dome sitting on the sphere,
 * oriented along its surface normal. There is deliberately no secondary LOD
 * layer — the previous point-sprite layer drew at the raw unit-vector radius,
 * i.e. inside the radius-2 globe, which is why the scene looked empty.
 */
export default function BookInstances() {
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const alphas = useAtlas((state) => state.alphas)
  const alphaVersion = useAtlas((state) => state.alphaVersion)
  const selectedId = useAtlas((state) => state.selectedId)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((state) => state.invalidate)

  const geometry = useMemo(
    () => new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.9,
        metalness: 0,
      }),
    [],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !points || !count) return

    const dummy = new THREE.Object3D()
    const unit = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const tint = new THREE.Color()
    const background = new THREE.Color(BG_HEX)
    let matricesWritten = 0
    let coloursWritten = 0

    for (let i = 0; i < count; i++) {
      const x = points.positions[i * 3]
      const y = points.positions[i * 3 + 1]
      const z = points.positions[i * 3 + 2]
      const length = Math.hypot(x, y, z) || 1
      unit.set(x / length, y / length, z / length)

      const bump = bumpSize(points.attrs.popularity[i])
      const visibility = (alphas[i] ?? 255) / 255
      const grow = (selectedId === i ? 1.4 : 1) * (0.76 + 0.24 * visibility)

      quaternion.setFromUnitVectors(UP, unit)
      dummy.position.copy(unit).multiplyScalar(SPHERE_RADIUS * 1.001)
      dummy.quaternion.copy(quaternion)
      dummy.scale.set(bump.radius * grow, bump.height * grow, bump.radius * grow)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      matricesWritten++

      tint.set(genreTint(points.attrs.genre[i]))
      tint.lerp(background, (1 - visibility) * 0.62)
      mesh.setColorAt(i, tint)
      coloursWritten++
    }

    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Instance matrices are written after mount, so any bounding sphere from
    // the empty mesh would be wrong; culling is disabled instead.
    mesh.frustumCulled = false
    mesh.computeBoundingSphere()
    invalidate()

    if (import.meta.env.DEV) {
      const first: { raw: number[]; radius: number }[] = []
      for (let i = 0; i < Math.min(3, count); i++) {
        const x = points.positions[i * 3]
        const y = points.positions[i * 3 + 1]
        const z = points.positions[i * 3 + 2]
        first.push({ raw: [x, y, z].map((n) => +n.toFixed(3)), radius: +Math.hypot(x, y, z).toFixed(3) })
      }
      const probe = new THREE.Matrix4()
      mesh.getMatrixAt(0, probe)
      const probePos = new THREE.Vector3().setFromMatrixPosition(probe)
      console.info(
        `[atlas] books=${count} matrices=${matricesWritten} colours=${coloursWritten} ` +
          `sphereRadius=${SPHERE_RADIUS} instance0WorldRadius=${probePos.length().toFixed(3)}`,
        first,
      )
    }
  }, [points, count, alphas, alphaVersion, selectedId, invalidate])

  if (!points || !count) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      renderOrder={1}
    />
  )
}
