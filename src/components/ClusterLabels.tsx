import { useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import type { Cluster } from '../data/types'
import { useAtlas } from '../store/atlas'

/** Continent names in letterpress, faded out as they rotate to the far side. */
export default function ClusterLabels() {
  const clusters = useAtlas((state) => state.clusters)
  if (!clusters.length) return null
  return (
    <>
      {clusters.map((cluster) => (
        <ClusterLabel key={cluster.id} cluster={cluster} />
      ))}
    </>
  )
}

function ClusterLabel({ cluster }: { cluster: Cluster }) {
  const ref = useRef<HTMLDivElement>(null)
  const selectedGenreCount = useAtlas((state) => {
    if (!state.activeGenres.length) return 0
    return state.activeGenres.includes(cluster.genre) ? 1 : -1
  })

  const unit = useMemo(
    () => new THREE.Vector3(...cluster.centroid).normalize(),
    [cluster.centroid],
  )

  const position = useMemo<[number, number, number]>(
    () => [unit.x * SPHERE_RADIUS * 1.035, unit.y * SPHERE_RADIUS * 1.035, unit.z * SPHERE_RADIUS * 1.035],
    [unit],
  )

  useFrame(({ camera }) => {
    const element = ref.current
    if (!element) return
    const facing = unit.dot(camera.position.clone().normalize())
    const visible = facing > 0.26
    const strength = visible ? Math.min(1, (facing - 0.26) * 3.4) : 0
    const dimmed = selectedGenreCount === -1 ? 0.28 : 1
    element.style.opacity = `${strength * dimmed}`
    element.style.transform = `scale(${camera.position.length() > 5.4 ? 0.92 : 1})`
  })

  return (
    <Html
      position={position}
      center
      zIndexRange={[14, 0]}
      style={{ pointerEvents: 'none' }}
      wrapperClass="pointer-events-none"
    >
      <div
        ref={ref}
        className="letterpress select-none whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.22em] transition-opacity duration-150"
        style={{ textShadow: '0 1px 0 rgba(255,255,255,0.9), 0 -1px 0 rgba(96,108,126,0.22)' }}
      >
        {cluster.name}
      </div>
    </Html>
  )
}
