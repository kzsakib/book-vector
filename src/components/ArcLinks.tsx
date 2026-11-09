import { useEffect, useMemo, useRef, useState } from 'react'
import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { genreTint } from '../lib/theme'
import { angleBetween, cosineBetween } from '../lib/similarity'
import { useAtlas } from '../store/atlas'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface ArcDatum {
  id: number
  rank: number
  points: THREE.Vector3[]
  colours: THREE.Color[]
  end: THREE.Vector3
  normal: THREE.Vector3
  colour: string
  opacity: number
  delay: number
  far: boolean
}

const STAGGER_MS = 40
const DRAW_MS = 600
const FAR_ANGLE = 60

function unitAt(positions: Float32Array, id: number): THREE.Vector3 {
  return new THREE.Vector3(
    positions[id * 3],
    positions[id * 3 + 1],
    positions[id * 3 + 2],
  ).normalize()
}

/** Quadratic arc lifted by sin(pi t) * 0.08 * radius, sampled for a gradient. */
function arcBetween(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const angle = from.angleTo(to)
  const lift = SPHERE_RADIUS * (0.08 + 0.035 * (1 - angle / Math.PI))
  const control = from
    .clone()
    .add(to)
    .normalize()
    .multiplyScalar(SPHERE_RADIUS * (1.08 + 0.04 * (1 - angle / Math.PI)))
  const points: THREE.Vector3[] = []
  const steps = 36
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push(
      new THREE.Vector3()
        .copy(from)
        .multiplyScalar((1 - t) * (1 - t))
        .addScaledVector(control, 2 * (1 - t) * t)
        .addScaledVector(to, t * t)
        .normalize()
        .multiplyScalar(SPHERE_RADIUS * 1.004 + Math.sin(Math.PI * t) * lift),
    )
  }
  return points
}

/** Only the interacting book produces lines: ten labelled spokes, or three on hover. */
export default function ArcLinks() {
  const points = useAtlas((state) => state.points)
  const selectedId = useAtlas((state) => state.selectedId)
  const nearby = useAtlas((state) => state.nearby)
  const showLinks = useAtlas((state) => state.showLinks)

  const arcs = useMemo<ArcDatum[]>(() => {
    if (!points || selectedId == null) return []
    const count = points.positions.length / 3
    const ids = nearby.filter((id) => id >= 0 && id < count && id !== selectedId).slice(0, 10)
    if (!ids.length) return []

    const from = unitAt(points.positions, selectedId)
    const fromColour = new THREE.Color(genreTint(points.attrs.genre[selectedId]))

    return ids.map((id, index) => {
      const to = unitAt(points.positions, id)
      const cosine = cosineBetween(points.positions, selectedId, id)
      const curve = arcBetween(from, to)
      const toColour = new THREE.Color(genreTint(points.attrs.genre[id]))
      const colours = curve.map((_, i) =>
        fromColour.clone().lerp(toColour, i / (curve.length - 1)),
      )
      const strength = Math.min(1, Math.max(0, (cosine - 0.35) / 0.55))
      return {
        id,
        rank: index + 1,
        points: curve,
        colours,
        end: curve[curve.length - 1].clone(),
        normal: to.clone(),
        colour: `#${toColour.getHexString()}`,
        opacity: 0.35 + strength * 0.6,
        delay: index * STAGGER_MS,
        far: angleBetween(points.positions, selectedId, id) > FAR_ANGLE,
      }
    })
  }, [points, selectedId, nearby])

  const hoveredId = useAtlas((state) => state.hoveredId)

  const hoverArcs = useMemo(() => {
    if (!points || hoveredId == null) return []
    const total = points.positions.length / 3
    const k = Math.max(1, Math.round(points.neighbors.length / Math.max(1, total)))
    const from = unitAt(points.positions, hoveredId)
    const out: { id: number; points: THREE.Vector3[]; colour: THREE.Color; opacity: number }[] = []
    for (let i = 0; i < 3; i++) {
      const id = points.neighbors[hoveredId * k + i]
      if (id == null || id < 0 || id >= total) continue
      out.push({
        id,
        points: arcBetween(from, unitAt(points.positions, id)),
        colour: new THREE.Color(genreTint(points.attrs.genre[id])),
        opacity: 0.34,
      })
    }
    return out
  }, [points, hoveredId])

  const [shown, setShown] = useState<{ arcs: ArcDatum[]; start: number } | null>(null)

  useEffect(() => {
    if (!arcs.length) {
      setShown(null)
      return
    }
    setShown({ arcs, start: performance.now() })
  }, [arcs])

  if (!showLinks) return null

  return (
    <group renderOrder={3}>
      {shown?.arcs.map((arc) => (
        <group key={`${shown.start}-${arc.id}`}>
          <Arc arc={arc} start={shown.start} />
          <Badge position={arc.end} normal={arc.normal} rank={arc.rank} colour={arc.colour} />
        </group>
      ))}
      {hoverArcs.map((arc) => (
        <Line
          key={`hover-${hoveredId}-${arc.id}`}
          points={arc.points}
          color={arc.colour}
          lineWidth={1}
          transparent
          opacity={arc.opacity}
          depthWrite={false}
          renderOrder={3}
        />
      ))}
    </group>
  )
}

function Arc({ arc, start }: { arc: ArcDatum; start: number }) {
  const line = useRef<{ material: THREE.Material & { opacity: number } } | null>(null)
  const reduced = useReducedMotion()
  const invalidate = useThree((state) => state.invalidate)
  const opacity = useRef(0)

  useFrame((_, delta) => {
    const elapsed = performance.now() - start - arc.delay
    const drawn = THREE.MathUtils.clamp(elapsed / DRAW_MS, 0, 1)
    const eased = 1 - Math.pow(1 - drawn, 3)
    const target = arc.opacity * eased
    opacity.current = reduced
      ? target
      : opacity.current + (target - opacity.current) * Math.min(1, (delta * 1000) / 120)
    const material = line.current?.material
    if (material) {
      material.opacity = opacity.current
      material.transparent = true
    }
    invalidate()
  })

  return (
    <Line
      ref={line as never}
      points={arc.points}
      vertexColors={arc.colours}
      lineWidth={arc.far ? 1 : 1.5}
      dashed={arc.far}
      dashSize={0.04}
      gapSize={0.03}
      transparent
      opacity={0}
      depthWrite={false}
      renderOrder={3}
    />
  )
}

/** Numbered badge matching the nearby list row, faded when facing away. */
function Badge({
  position,
  normal,
  rank,
  colour,
}: {
  position: THREE.Vector3
  normal: THREE.Vector3
  rank: number
  colour: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useFrame(({ camera }) => {
    const node = ref.current
    if (!node) return
    const facing = normal.dot(camera.position.clone().normalize())
    node.style.opacity = facing > 0.12 ? '1' : '0'
  })

  return (
    <Html position={position} center zIndexRange={[18, 8]} style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="dot-badge" style={{ boxShadow: `0 0 0 2px ${colour}22` }}>
        {rank}
      </div>
    </Html>
  )
}
