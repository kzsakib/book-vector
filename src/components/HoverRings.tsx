import { useMemo } from 'react'
import * as THREE from 'three'
import { SPHERE_RADIUS, bumpSize } from '../data/format'
import { genreTint } from '../lib/theme'
import { useAtlas } from '../store/atlas'

const UP = new THREE.Vector3(0, 1, 0)
/** RingGeometry faces +Z; rotate it onto the surface tangent plane first. */
const RING_BASIS = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)

/** Soft rings on the hovered book's three nearest neighbours. */
export default function HoverRings() {
  const hoveredId = useAtlas((state) => state.hoveredId)
  const points = useAtlas((state) => state.points)

  const rings = useMemo(() => {
    if (!points || hoveredId == null) return []
    const count = points.positions.length / 3
    const k = Math.max(1, Math.round(points.neighbors.length / Math.max(1, count)))
    const out: {
      key: string
      position: THREE.Vector3
      quaternion: THREE.Quaternion
      size: number
      color: string
    }[] = []

    for (let i = 0; i < 3; i++) {
      const id = points.neighbors[hoveredId * k + i]
      if (id == null || id < 0 || id >= count) continue
      const x = points.positions[id * 3]
      const y = points.positions[id * 3 + 1]
      const z = points.positions[id * 3 + 2]
      const unit = new THREE.Vector3(x, y, z).normalize()
      const bump = bumpSize(points.attrs.popularity[id])
      out.push({
        key: `${hoveredId}-${id}`,
        position: unit.clone().multiplyScalar(SPHERE_RADIUS * 1.004),
        quaternion: new THREE.Quaternion()
          .setFromUnitVectors(UP, unit)
          .multiply(RING_BASIS),
        size: bump.radius * 2.9,
        color: genreTint(points.attrs.genre[id]),
      })
    }
    return out
  }, [points, hoveredId])

  if (!rings.length) return null

  return (
    <group renderOrder={3}>
      {rings.map((ring) => (
        <mesh
          key={ring.key}
          position={ring.position}
          quaternion={ring.quaternion}
          scale={ring.size}
          renderOrder={3}
        >
          <ringGeometry args={[0.8, 1.02, 36]} />
          <meshBasicMaterial
            color={ring.color}
            transparent
            opacity={0.48}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
