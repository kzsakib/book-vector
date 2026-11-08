import {
  decodeAttrs,
  decodeNeighbors,
  decodePositions,
  fetchBuffer,
  fetchJson,
} from './format'
import type { AtlasPoints, BookMeta, ClusterFile, Manifest } from './types'

export interface LoadHandlers {
  onManifest: (manifest: Manifest, clusters: ClusterFile) => void
  onPoints: (points: AtlasPoints, count: number, k: number) => void
  onMeta: (start: number, books: BookMeta[]) => void
  onDone: () => void
}

/**
 * Progressive load:
 *   1. manifest + cluster labels (~a few KB) so the globe paints immediately
 *   2. positions / attrs / neighbours binaries
 *   3. metadata chunks, streamed so search coverage grows as they land
 */
export async function loadAtlas(handlers: LoadHandlers, signal?: AbortSignal): Promise<void> {
  const manifest = await fetchJson<Manifest>('manifest.json')
  if (signal?.aborted) return
  const clusters = await fetchJson<ClusterFile>('clusters.json')
  if (signal?.aborted) return
  handlers.onManifest(manifest, clusters)

  const count = manifest.count
  const [positionsBuffer, attrsBuffer, neighborsBuffer] = await Promise.all([
    fetchBuffer('positions.bin'),
    fetchBuffer('attrs.bin'),
    fetchBuffer('neighbors.bin'),
  ])
  if (signal?.aborted) return

  if (positionsBuffer.byteLength < count * 6) {
    throw new Error('positions.bin is smaller than the manifest advertises')
  }

  const points: AtlasPoints = {
    positions: decodePositions(positionsBuffer, count),
    attrs: decodeAttrs(attrsBuffer, count),
    neighbors: decodeNeighbors(neighborsBuffer, count, manifest.neighbors),
  }
  handlers.onPoints(points, count, manifest.neighbors)

  for (let chunk = 0; chunk < manifest.chunks; chunk++) {
    if (signal?.aborted) return
    const books = await fetchJson<BookMeta[]>(`meta-${chunk}.json`)
    handlers.onMeta(chunk * manifest.chunkSize, books)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (!signal?.aborted) handlers.onDone()
}
