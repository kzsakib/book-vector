import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { genreTint } from '../lib/theme'
import { useAtlas } from '../store/atlas'

const DRAW_MS = 600
const STAGGER_MS = 40
const FADE_MS = 280
const HOLD_MS = 260

interface ArcDatum {
  curve: THREE.CatmullRomCurve3
  color: string
  delay: number
}

function unitAt(positions: Float32Array, id: number): THREE.Vector3 {
  return new THREE.Vector3(
    positions[id * 3],
    positions[id * 3 + 1],
    positions[id * 3 + 2],
  ).normalize()
}

/** Great-circle path lifted by sin(pi t) * 0.10 * radius. */
function arcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.CatmullRomCurve3 {
  const samples: THREE.Vector3[] = []
  const lift = SPHERE_RADIUS * 0.1
  for (let i = 0; i <= 36; i++) {
    const t = i / 36
    const p = new THREE.Vector3().lerpVectors(from, to, t).normalize()
    const radius = SPHERE_RADIUS * 1.002 + Math.sin(Math.PI * t) * lift
    samples.push(p.multiplyScalar(radius))
  }
  return new THREE.CatmullRomCurve3(samples, false, 'catmullrom', 0.5)
}

/**
 * Arcs from the selected book to its ten nearest neighbours. Real geometry
 * (tubes) so line width is honoured everywhere; each tube reveals itself by
 * animating its index draw range, staggered 40 ms per arc.
 */
export default function ArcLinks() {
  const points = useAtlas((state) => state.points)
  const selectedId = useAtlas((state) => state.selectedId)
  const nearby = useAtlas((state) => state.nearby)

  const live = useMemo<ArcDatum[]>(() => {
    if (!points || selectedId == null) return []
    const count = points.positions.length / 3
    const k = Math.max(1, Math.round(points.neighbors.length / Math.max(1, count)))
    const ids: number[] = nearby
      .filter((id: number) => id >= 0 && id < count)
      .slice(0, 10)
    if (!ids.length) {
      for (let i = 0; i < k && ids.length < 10; i++) {
        const neighbour: number = points.neighbors[selectedId * k + i]
        if (neighbour >= 0 && neighbour < count && neighbour !== selectedId) {
          ids.push(neighbour)
        }
      }
    }
    const from = unitAt(points.positions, selectedId)
    const color = genreTint(points.attrs.genre[selectedId])
    return ids.map((id: number, index: number) => ({
      curve: arcCurve(from, unitAt(points.positions, id)),
      color,
      delay: index * STAGGER_MS,
    }))
  }, [points, selectedId, nearby])

  const [shown, setShown] = useState<{ arcs: ArcDatum[]; start: number } | null>(null)
  const active = selectedId != null && live.length > 0

  useEffect(() => {
    if (!live.length) return
    setShown({ arcs: live, start: performance.now() })
  }, [live])

  useEffect(() => {
    if (selectedId != null) return
    const timer = window.setTimeout(() => setShown(null), HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [selectedId])

  if (!shown) return null

  return (
    <group renderOrder={3}>
      {shown.arcs.map((arc, index) => (
        <Arc
          key={`${index}-${shown.start}`}
          curve={arc.curve}
          color={arc.color}
          delay={arc.delay}
          start={shown.start}
          active={active}
        />
      ))}
    </group>
  )
}

function Arc({
  curve,
  color,
  delay,
  start,
  active,
}: {
  curve: THREE.CatmullRomCurve3
  color: string
  delay: number
  start: number
  active: boolean
}) {
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 72, 0.022, 6, false),
    [curve],
  )
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [color],
  )
  const total = geometry.index ? geometry.index.count : 0
  const opacity = useRef(0)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    geometry.setDrawRange(0, 0)
    return () => geometry.dispose()
  }, [geometry])

  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const elapsed = performance.now() - start - delay
    const drawn = Math.min(1, Math.max(0, elapsed / DRAW_MS))
    geometry.setDrawRange(0, Math.floor(total * drawn))
    const target = active ? 0.82 * drawn : 0
    const step = (delta * 1000) / FADE_MS
    opacity.current += (target - opacity.current) * Math.min(1, step * 3)
    material.opacity = opacity.current
    invalidate()
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
