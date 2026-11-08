import { useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { useAtlas } from '../store/atlas'

/** The raised rounded-square pin that marks the selected book. */
export default function SelectedPin() {
  const selectedId = useAtlas((state) => state.selectedId)
  const points = useAtlas((state) => state.points)
  const clusters = useAtlas((state) => state.clusters)
  const clusterOf = useAtlas((state) => state.clusterOf)
  const meta = useAtlas((state) =>
    state.selectedId == null ? null : state.meta[state.selectedId],
  )
  const ref = useRef<HTMLDivElement>(null)

  const unit = useMemo(() => {
    if (!points || selectedId == null) return null
    const x = points.positions[selectedId * 3]
    const y = points.positions[selectedId * 3 + 1]
    const z = points.positions[selectedId * 3 + 2]
    return new THREE.Vector3(x, y, z).normalize()
  }, [points, selectedId])

  const colour = clusterOf && selectedId != null ? clusters[clusterOf[selectedId]]?.color : null

  useFrame(({ camera }) => {
    const element = ref.current
    if (!element || !unit) return
    const facing = unit.dot(camera.position.clone().normalize())
    element.style.opacity = facing > 0.1 ? '1' : '0'
  })

  if (!unit || selectedId == null || !points) return null

  const position: [number, number, number] = [
    unit.x * SPHERE_RADIUS * 1.018,
    unit.y * SPHERE_RADIUS * 1.018,
    unit.z * SPHERE_RADIUS * 1.018,
  ]

  return (
    <Html
      position={position}
      center
      zIndexRange={[30, 0]}
      style={{ pointerEvents: 'none' }}
      wrapperClass="pointer-events-none"
    >
      <div
        ref={ref}
        className="relative -translate-y-4 transition-opacity duration-200"
        aria-hidden
      >
        <div
          className="grid h-9 w-9 place-items-center rounded-[12px] text-white/90 shadow-[0_10px_18px_-6px_rgba(96,104,128,0.55)]"
          style={{
            background: `linear-gradient(145deg, ${colour ?? '#b9aef0'}, ${colour ?? '#b9aef0'})`,
            boxShadow:
              'inset 2px 2px 4px rgba(255,255,255,0.55), inset -2px -2px 4px rgba(92,100,124,0.25), 0 10px 18px -6px rgba(96,104,128,0.55)',
          }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 5.4C10.3 4.2 8.2 3.9 6 4.4v13.2c2.2-.5 4.3-.2 6 1 1.7-1.2 3.8-1.5 6-1V4.4c-2.2-.5-4.3-.2-6 1.3Z" strokeLinejoin="round" />
            <path d="M12 5.4v13.2" strokeLinecap="round" />
          </svg>
        </div>
        <div
          className="mx-auto -mt-1 h-2.5 w-2.5 rotate-45 rounded-[2px]"
          style={{
            background: colour ?? '#b9aef0',
            boxShadow: '0 6px 10px -4px rgba(96,104,128,0.5)',
          }}
        />
        <span className="sr-only">{meta?.t ?? 'Selected book'}</span>
      </div>
    </Html>
  )
}
