import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import type { Cluster } from '../data/types'
import { genreTint } from '../lib/theme'
import { atlasView } from '../lib/view'
import { useAtlas } from '../store/atlas'

interface LabelDatum {
  key: string
  name: string
  normal: THREE.Vector3
  count: number
  genre: number
  color: string
}

const LABEL_RADIUS = SPHERE_RADIUS * 1.002

/**
 * Letterpress continent labels. Projection, horizon fading and screen-box
 * collision culling all happen in the render loop (never in React state), so
 * labels stay readable and never spill past the globe's silhouette.
 */
export default function ClusterLabels() {
  const clusters = useAtlas((state) => state.clusters)
  const genres = useAtlas((state) => state.genres)
  const showLabels = useAtlas((state) => state.showLabels)
  const activeGenres = useAtlas((state) => state.activeGenres)
  const selectedId = useAtlas((state) => state.selectedId)

  const [tier, setTier] = useState<'genre' | 'cluster'>('genre')
  const tierRef = useRef<'genre' | 'cluster'>('genre')
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)

  // Zoomed out: one label per genre. Zoomed in: the finer continents.
  useFrame(() => {
    const zoom = atlasView.zoom
    const next: 'genre' | 'cluster' =
      tierRef.current === 'genre' ? (zoom > 1.24 ? 'cluster' : 'genre') : zoom < 1.06 ? 'genre' : 'cluster'
    if (next !== tierRef.current) {
      tierRef.current = next
      setTier(next)
    }
  })

  const labels = useMemo<LabelDatum[]>(() => {
    if (!clusters.length) return []

    if (tier === 'genre') {
      const seen = new Set<number>()
      const out: LabelDatum[] = []
      for (const genre of genres) {
        const index = genres.findIndex((item) => item.id === genre.id)
        const members = clusters.filter((cluster) => cluster.genre === index)
        if (!members.length || seen.has(index)) continue
        seen.add(index)
        const normal = new THREE.Vector3()
        let count = 0
        for (const member of members) {
          normal.add(new THREE.Vector3(...member.centroid).normalize().multiplyScalar(member.count))
          count += member.count
        }
        if (normal.lengthSq() === 0) continue
        out.push({
          key: `genre-${index}`,
          name: genre.name,
          normal: normal.normalize(),
          count,
          genre: index,
          color: genreTint(index),
        })
      }
      return out
    }

    return clusters.map((cluster: Cluster) => ({
      key: `cluster-${cluster.id}`,
      name: cluster.name,
      normal: new THREE.Vector3(...cluster.centroid).normalize(),
      count: cluster.count,
      genre: cluster.genre,
      color: cluster.color || genreTint(cluster.genre),
    }))
  }, [clusters, genres, tier])

  const projected = useRef(new THREE.Vector3())
  const cameraDir = useRef(new THREE.Vector3())
  const active = useRef(activeGenres.length)
  active.current = activeGenres.length

  useFrame(() => {
    if (!showLabels) return
    camera.getWorldDirection(cameraDir.current)
    cameraDir.current.negate()
    const boxes: { x: number; y: number; w: number; h: number }[] = []
    const ordered = [...labels].sort((a, b) => b.count - a.count)

    for (const label of ordered) {
      const element = nodes.current.get(label.key)
      if (!element) continue

      const facing = label.normal.dot(cameraDir.current)
      if (facing < 0.25) {
        element.style.opacity = '0'
        element.style.visibility = 'hidden'
        continue
      }

      projected.current.copy(label.normal).multiplyScalar(LABEL_RADIUS).project(camera)
      const rawX = (projected.current.x * 0.5 + 0.5) * size.width
      const rawY = (-projected.current.y * 0.5 + 0.5) * size.height
      if (projected.current.z > 1) {
        element.style.opacity = '0'
        element.style.visibility = 'hidden'
        continue
      }

      const width = element.offsetWidth || 90
      const height = element.offsetHeight || 16
      // Below 1240px the right rail floats over the canvas: keep 140px clear
      // of the sheet so labels never sit under the selected card.
      const reserved = selectedId != null && size.width < 1240 ? 356 : 0
      // Ease rim labels inward instead of dropping them at the silhouette.
      const x = Math.min(
        Math.max(rawX, width / 2 + 8),
        Math.max(width / 2 + 8, size.width - reserved - width / 2 - 8),
      )
      // Keep continent names above the dock and hint strip.
      const y = Math.min(Math.max(rawY, height / 2 + 8), size.height - height / 2 - 152)
      const box = { x: x - width / 2, y: y - height / 2, w: width, h: height }
      // Never let a label spill past the stage edge.
      if (
        box.x < 6 ||
        box.y < 6 ||
        box.x + box.w > size.width - reserved - 6 ||
        box.y + box.h > size.height - 6
      ) {
        element.style.opacity = '0'
        element.style.visibility = 'hidden'
        continue
      }
      const collision = boxes.some(
        (other) =>
          box.x < other.x + other.w + 8 &&
          box.x + box.w + 8 > other.x &&
          box.y < other.y + other.h + 6 &&
          box.y + box.h + 6 > other.y,
      )
      const dimmed =
        active.current > 0 && !activeGenres.includes(label.genre) ? 0.24 : 1
      const fade = Math.min(1, (facing - 0.25) * 4)

      if (collision) {
        element.style.opacity = '0'
        element.style.visibility = 'hidden'
        continue
      }

      // Never drop a label into the dock/hint band at the bottom of the stage.
      if (y > size.height - 190) {
        element.style.opacity = '0'
        element.style.visibility = 'hidden'
        continue
      }

      boxes.push(box)
      element.style.visibility = 'visible'
      element.style.opacity = `${fade * dimmed}`
      // Actually move the label when it was eased inward from the rim.
      element.style.transform = `translate(${Math.round(x - rawX)}px, ${Math.round(y - rawY)}px)`
    }
  })

  useEffect(() => {
    invalidate()
  }, [showLabels, labels, invalidate])

  if (!showLabels || !labels.length) return null

  return (
    <>
      {labels.map((label) => (
        <Html
          key={label.key}
          position={[
            label.normal.x * LABEL_RADIUS,
            label.normal.y * LABEL_RADIUS,
            label.normal.z * LABEL_RADIUS,
          ]}
          center
          zIndexRange={[12, 0]}
          style={{ pointerEvents: 'none' }}
          wrapperClass="pointer-events-none"
        >
          <div
            ref={(element) => {
              if (element) nodes.current.set(label.key, element)
              else nodes.current.delete(label.key)
            }}
            className="atlas-label"
            style={{ opacity: 0 }}
          >
            <span
              className="atlas-label-dot"
              style={{ background: label.color }}
              aria-hidden
            />
            {label.name}
          </div>
        </Html>
      ))}
    </>
  )
}
