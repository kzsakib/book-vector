import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/**
 * Quadratic arc lifted by sin(pi t) * 0.08 * radius (the drei quadratic
 * equivalent, sampled so each stroke can carry a vertex gradient).
 */
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
    const p = new THREE.Vector3()
      .copy(from)
      .multiplyScalar((1 - t) * (1 - t))
      .addScaledVector(control, 2 * (1 - t) * t)
      .addScaledVector(to, t * t)
      .normalize()
      .multiplyScalar(SPHERE_RADIUS * 1.004 + Math.sin(Math.PI * t) * lift)
    points.push(p)
  }
  return points
}

/**
 * Only the book you are interacting with produces lines: ten labelled spokes
 * from the selection, opacity scaled by similarity, dashed when the neighbour
 * lives more than 60° away. No ambient threads, so no hairball.
 */
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
      // Similarity drives opacity: 0.35 at a 0.35 cosine, 0.95 at 0.9.
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
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const badgeNodes = useRef(new Map<number, HTMLDivElement>())

  const registerBadge = useCallback((rank: number, node: HTMLDivElement | null) => {
    if (node) badgeNodes.current.set(rank, node)
    else badgeNodes.current.delete(rank)
  }, [])

  // Badges are 18px, so relax overlapping pairs to a 24px minimum over six
  // passes and clamp them inside the stage.
  useFrame(() => {
    const arcsShown = shown?.arcs
    if (!arcsShown?.length) return
    const view = camera.position.clone().normalize()
    const items = arcsShown.map((arc) => {
      const projected = arc.end.clone().project(camera)
      return {
        el: badgeNodes.current.get(arc.rank),
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        dx: 0,
        dy: 0,
        facing: arc.normal.dot(view),
      }
    })

    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]
          const b = items[j]
          let dx = b.x + b.dx - (a.x + a.dx)
          let dy = b.y + b.dy - (a.y + a.dy)
          let distance = Math.hypot(dx, dy)
          if (distance >= 24) continue
          if (distance < 0.001) {
            dx = 1
            dy = (j - i) * 0.5
            distance = Math.hypot(dx, dy)
          }
          const push = (24 - distance) / 2
          const ux = dx / distance
          const uy = dy / distance
          a.dx -= ux * push
          a.dy -= uy * push
          b.dx += ux * push
          b.dy += uy * push
        }
      }
    }

    for (const item of items) {
      if (!item.el) continue
      const x = Math.min(Math.max(item.x + item.dx, 20), size.width - 20)
      const y = Math.min(Math.max(item.y + item.dy, 20), size.height - 20)
      item.el.style.transform = `translate(${(x - item.x).toFixed(1)}px, ${(y - item.y).toFixed(1)}px)`
      item.el.style.opacity = item.facing > 0.12 ? '1' : '0'
    }
  })

  // Hover alone gets three thin spokes, so a dot explains its neighbours
  // before anything is selected.
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
      {shown?.arcs.map((arc) => {
        const anchor = arc.end.clone().multiplyScalar(1.06)
        return (
          <group key={`${shown.start}-${arc.id}`}>
            <Arc arc={arc} start={shown.start} />
            <Line
              points={[arc.end, anchor]}
              color={arc.colour}
              lineWidth={1}
              transparent
              opacity={0.5}
              depthWrite={false}
              renderOrder={3}
            />
            <Badge
              position={anchor}
              rank={arc.rank}
              colour={arc.colour}
              register={registerBadge}
            />
          </group>
        )
      })}
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
  rank,
  colour,
  register,
}: {
  position: THREE.Vector3
  rank: number
  colour: string
  register: (rank: number, node: HTMLDivElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    register(rank, ref.current)
    return () => register(rank, null)
  }, [rank, register])

  return (
    <Html position={position} center zIndexRange={[18, 8]} style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="dot-badge" style={{ boxShadow: `0 0 0 2px ${colour}22` }}>
        {rank}
      </div>
    </Html>
  )
}
