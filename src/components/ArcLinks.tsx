import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { genreTint, pastel } from '../lib/theme'
import { useAtlas } from '../store/atlas'
import { useReducedMotion } from '../hooks/useReducedMotion'

const STAGGER_MS = 40
const FADE_MS = 600

interface ArcDatum {
  id: number
  points: THREE.Vector3[]
  colours: THREE.Color[]
  end: THREE.Vector3
  color: string
  delay: number
  far: boolean
}

function unitAt(positions: Float32Array, id: number): THREE.Vector3 {
  return new THREE.Vector3(
    positions[id * 3],
    positions[id * 3 + 1],
    positions[id * 3 + 2],
  ).normalize()
}

/**
 * Great-circle arc from the selected book to a neighbour, lifted by
 * sin(pi t) * (0.08 + up to 0.05) * radius. Nearby neighbours get a taller arch
 * so ten spokes leaving the same cluster stay visually separate.
 */
function arcPoints(from: THREE.Vector3, to: THREE.Vector3): { points: THREE.Vector3[]; angle: number } {
  const angle = from.angleTo(to)
  const lift = SPHERE_RADIUS * (0.08 + 0.05 * (1 - angle / Math.PI))
  const samples: THREE.Vector3[] = []
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = new THREE.Vector3().lerpVectors(from, to, t).normalize()
    samples.push(p.multiplyScalar(SPHERE_RADIUS * 1.004 + Math.sin(Math.PI * t) * lift))
  }
  return { points: samples, angle }
}

/**
 * Ten thin gradient arcs from the selected book to its nearest neighbours:
 * 1.2px Line2 strokes, staggered fade-in, a glowing dot at each arrival, and
 * dashed thin lines for far neighbours. Deliberately not tubes — tubes at this
 * scale read as ropes.
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
      .filter((id: number) => id >= 0 && id < count && id !== selectedId)
      .slice(0, 10)
    if (!ids.length) {
      for (let i = 0; i < k && ids.length < 10; i++) {
        const neighbour: number = points.neighbors[selectedId * k + i]
        if (neighbour >= 0 && neighbour < count && neighbour !== selectedId) ids.push(neighbour)
      }
    }

    const from = unitAt(points.positions, selectedId)
    const fromColour = new THREE.Color(pastel(genreTint(points.attrs.genre[selectedId]), 0.8))

    return ids.map((id: number, index: number) => {
      const to = unitAt(points.positions, id)
      const { points: curve, angle } = arcPoints(from, to)
      const toColour = new THREE.Color(pastel(genreTint(points.attrs.genre[id]), 0.8))
      const colours = curve.map((_, i) => fromColour.clone().lerp(toColour, i / (curve.length - 1)))
      return {
        id,
        points: curve,
        colours,
        end: curve[curve.length - 1].clone(),
        color: `#${toColour.getHexString()}`,
        delay: index * STAGGER_MS,
        far: angle > Math.PI / 3,
      }
    })
  }, [points, selectedId, nearby])

  const [shown, setShown] = useState<{ arcs: ArcDatum[]; start: number } | null>(null)
  const active = selectedId != null && live.length > 0

  useEffect(() => {
    if (!live.length) return
    setShown({ arcs: live, start: performance.now() })
  }, [live])

  useEffect(() => {
    if (selectedId != null) return
    const timer = window.setTimeout(() => setShown(null), FADE_MS + 60)
    return () => window.clearTimeout(timer)
  }, [selectedId])

  if (!shown) return null

  return (
    <group renderOrder={3}>
      {shown.arcs.map((arc) => (
        <Arc
          key={`${shown.start}-${arc.id}`}
          arc={arc}
          start={shown.start}
          active={active}
        />
      ))}
    </group>
  )
}

function Arc({ arc, start, active }: { arc: ArcDatum; start: number; active: boolean }) {
  const line = useRef<{ material: THREE.Material & { opacity: number } } | null>(null)
  const dot = useRef<THREE.Mesh>(null)
  const dotMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: arc.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [arc.color],
  )
  const invalidate = useThree((state) => state.invalidate)
  const reduced = useReducedMotion()
  const opacity = useRef(0)

  useEffect(() => () => dotMaterial.dispose(), [dotMaterial])

  useFrame((_, delta) => {
    const elapsed = performance.now() - start - arc.delay
    const drawn = THREE.MathUtils.clamp(elapsed / FADE_MS, 0, 1)
    const eased = 1 - Math.pow(1 - drawn, 3)
    const target = active ? (arc.far ? 0.45 : 0.75) * eased : 0
    if (reduced) opacity.current = target
    else {
      const step = Math.min(delta, 0.08) * 1000
      opacity.current += (target - opacity.current) * Math.min(1, step / 160)
    }

    const material = line.current?.material
    if (material) {
      material.opacity = opacity.current
      material.transparent = true
    }
    dotMaterial.opacity = opacity.current * 0.95
    if (dot.current) {
      const pop = active ? eased : 0
      dot.current.scale.setScalar(0.6 + 0.4 * pop)
      dot.current.visible = pop > 0.02
    }
    invalidate()
  })

  return (
    <group renderOrder={3}>
      <Line
        // drei forwards the ref to the underlying Line2 instance.
        ref={line as never}
        points={arc.points}
        vertexColors={arc.colours}
        lineWidth={arc.far ? 1 : 1.2}
        dashed={arc.far}
        dashSize={0.035}
        gapSize={0.025}
        transparent
        opacity={0}
        depthWrite={false}
        renderOrder={3}
      />
      <mesh ref={dot} position={arc.end} renderOrder={4}>
        <sphereGeometry args={[0.016, 10, 8]} />
        <primitive object={dotMaterial} attach="material" />
      </mesh>
    </group>
  )
}
