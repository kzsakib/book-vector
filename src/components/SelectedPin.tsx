import { useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { genreTint } from '../lib/theme'
import { useAtlas } from '../store/atlas'

const UP = new THREE.Vector3(0, 1, 0)
const RING_BASIS = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
)

/**
 * Selected book marker: two expanding halo rings in the book's own colour plus
 * a small Fraunces label on a leader line. Anchored to the dot's surface normal
 * and hidden as soon as it turns past the limb.
 */
export default function SelectedPin() {
  const selectedId = useAtlas((state) => state.selectedId)
  const points = useAtlas((state) => state.points)
  const meta = useAtlas((state) =>
    state.selectedId == null ? null : state.meta[state.selectedId],
  )
  const groupRef = useRef<THREE.Group>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  const data = useMemo(() => {
    if (!points || selectedId == null) return null
    const unit = new THREE.Vector3(
      points.positions[selectedId * 3],
      points.positions[selectedId * 3 + 1],
      points.positions[selectedId * 3 + 2],
    ).normalize()
    return {
      unit,
      position: unit.clone().multiplyScalar(SPHERE_RADIUS * 1.008),
      quaternion: new THREE.Quaternion()
        .setFromUnitVectors(UP, unit)
        .multiply(RING_BASIS),
      colour: genreTint(points.attrs.genre[selectedId]),
    }
  }, [points, selectedId])

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group || !data) return
    const facing = data.unit.dot(camera.position.clone().normalize())
    const visible = facing > 0.12
    group.visible = visible
    if (labelRef.current) labelRef.current.style.opacity = visible ? '1' : '0'

    const t = (performance.now() % 2400) / 2400
    for (const [ref, offset] of [
      [ringA, 0],
      [ringB, 0.5],
    ] as const) {
      const ring = ref.current
      if (!ring) continue
      const phase = (t + offset) % 1
      ring.scale.setScalar(1 + phase * 2.1)
      const material = ring.material as THREE.MeshBasicMaterial
      material.opacity = (1 - phase) * 0.5
    }
  })

  if (!data) return null

  return (
    <group
      ref={groupRef}
      position={data.position}
      quaternion={data.quaternion}
      renderOrder={5}
    >
      <mesh ref={ringA} renderOrder={4}>
        <ringGeometry args={[0.022, 0.032, 40]} />
        <meshBasicMaterial color={data.colour} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} renderOrder={4}>
        <ringGeometry args={[0.022, 0.032, 40]} />
        <meshBasicMaterial color={data.colour} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh renderOrder={5}>
        <circleGeometry args={[0.0125, 24]} />
        <meshBasicMaterial color={data.colour} transparent opacity={0.95} depthWrite={false} />
      </mesh>

      <Html position={[0, 0.24, 0]} center zIndexRange={[22, 16]} style={{ pointerEvents: 'none' }}>
        <div ref={labelRef} className="selected-label">
          <span className="selected-label-line" style={{ background: data.colour }} aria-hidden />
          <span className="selected-label-title">{meta?.t ?? 'Selected book'}</span>
          {meta ? (
            <span className="selected-label-author">
              {meta.a} · {meta.y}
            </span>
          ) : null}
        </div>
      </Html>
    </group>
  )
}
