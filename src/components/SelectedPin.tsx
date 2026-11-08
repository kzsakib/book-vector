import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SPHERE_RADIUS, bumpSize } from '../data/format'
import { genreTint } from '../lib/theme'
import { useAtlas } from '../store/atlas'

const UP = new THREE.Vector3(0, 1, 0)

/**
 * The selected book's pin is real geometry anchored to that book's normal:
 * a stem plus a raised rounded square. It is hidden as soon as the book turns
 * past the limb, so it can never drift onto another label.
 */
export default function SelectedPin() {
  const selectedId = useAtlas((state) => state.selectedId)
  const points = useAtlas((state) => state.points)
  const groupRef = useRef<THREE.Group>(null)

  const data = useMemo(() => {
    if (!points || selectedId == null) return null
    const x = points.positions[selectedId * 3]
    const y = points.positions[selectedId * 3 + 1]
    const z = points.positions[selectedId * 3 + 2]
    const unit = new THREE.Vector3(x, y, z).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, unit)
    const position = unit.clone().multiplyScalar(SPHERE_RADIUS * 1.001)
    const bump = bumpSize(points.attrs.popularity[selectedId])
    return {
      unit,
      quaternion,
      position,
      color: genreTint(points.attrs.genre[selectedId]),
      scale: Math.max(1, bump.radius / (SPHERE_RADIUS * 0.012)),
    }
  }, [points, selectedId])

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group || !data) return
    const facing = data.unit.dot(camera.position.clone().normalize())
    group.visible = facing > 0.12
  })

  if (!data) return null

  return (
    <group
      ref={groupRef}
      position={data.position}
      quaternion={data.quaternion}
      scale={data.scale}
      renderOrder={4}
    >
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.008, 0.011, 0.12, 10]} />
        <meshStandardMaterial color={data.color} roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.046, 32]} />
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <RoundedBox
        args={[0.15, 0.155, 0.05]}
        radius={0.03}
        smoothness={4}
        position={[0, 0.16, 0]}
      >
        <meshStandardMaterial color={data.color} roughness={0.55} metalness={0} />
      </RoundedBox>
      <mesh position={[0, 0.16, 0.028]}>
        <circleGeometry args={[0.032, 24]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.82} />
      </mesh>
    </group>
  )
}
