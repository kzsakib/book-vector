import { useEffect } from 'react'
import { SPHERE_RADIUS } from '../data/format'
import { loadAtlas } from '../data/load'
import { useAtlas } from '../store/atlas'
import { atlas } from '../workers/atlasClient'

/** Streams the dataset in and hands the worker its picking + search inputs. */
export function useBootstrap(): void {
  useEffect(() => {
    const controller = new AbortController()
    const stopIndexListener = atlas.onIndexed((count) =>
      useAtlas.getState().setSearchIndexed(count),
    )

    loadAtlas(
      {
        onManifest: (manifest, clusters) =>
          useAtlas.getState().setManifest(manifest, clusters.clusters),
        onPoints: (points, count, k) => {
          useAtlas.getState().setPoints(points, count)
          atlas.init(points.positions.slice(), points.neighbors.slice(), count, k, SPHERE_RADIUS)
          // The globe is interactive as soon as the binaries land; metadata keeps
          // streaming in behind it so 50k books never block first paint.
          useAtlas.getState().setPhase('ready')
        },
        onMeta: (start, books) => {
          useAtlas.getState().setMetaChunk(start, books)
          atlas.addMeta(start, books)
        },
        onDone: () => useAtlas.getState().setPhase('ready'),
      },
      controller.signal,
    ).catch((error: unknown) => {
      if (controller.signal.aborted) return
      useAtlas
        .getState()
        .setError(error instanceof Error ? error.message : 'Could not load the atlas')
    })

    return () => {
      controller.abort()
      stopIndexListener()
    }
  }, [])
}
