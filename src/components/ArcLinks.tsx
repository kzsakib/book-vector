import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { useAtlas } from '../store/atlas'

/** Soft raised arcs from the selected book to its nearest neighbours. */
export default function ArcLinks() {
  const points = useAtlas((state) => state.points)
  const selectedId = useAtlas((state) => state.selectedId)
  const nearby = useAtlas((state) => state.nearby)

  const arcs = useMemo(() => {
    if (!points || selectedId == null || !nearby.length) return []
    const positionAt = (id: number) => {
      const x = points.positions[id * 3]
      const y = points.positions[id * 3 + 1]
      const z = points.positions[id * 3 + 2]
      return new THREE.Vector3(x, y, z).normalize()
    }
    const start = positionAt(selectedId)
    return nearby.slice(0, 10).map((id) => {
      const end = positionAt(id)
      const chord = start.distanceTo(end)
      const mid = start
        .clone()
        .add(end)
        .normalize()
        .multiplyScalar(SPHERE_RADIUS * (1.035 + chord * 0.5))
      const curve = new THREE.QuadraticBezierCurve3(
        start.clone().multiplyScalar(SPHERE_RADIUS * 1.002),
        mid,
        end.clone().multiplyScalar(SPHERE_RADIUS * 1.002),
      )
      return curve.getPoints(26).map((p) => [p.x, p.y, p.z] as [number, number, number])
    })
  }, [points, selectedId, nearby])

  if (!arcs.length) return null

  return (
    <group renderOrder={3}>
      {arcs.map((arc, index) => (
        <Line
          key={index}
          points={arc}
          color="#8a97ab"
          lineWidth={1.1}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      ))}
    </group>
  )
}
