import { create } from 'zustand'
import { DIM_ALPHA, inEra } from '../data/format'
import type {
  AtlasPoints,
  BookMeta,
  Cluster,
  Era,
  Focus,
  Genre,
  Manifest,
} from '../data/types'
import { atlas } from '../workers/atlasClient'

export type Phase = 'boot' | 'loading' | 'ready' | 'error'

export interface AtlasState {
  phase: Phase
  error: string | null
  manifest: Manifest | null
  genres: Genre[]
  clusters: Cluster[]
  count: number
  metaLoaded: number
  searchIndexed: number
  points: AtlasPoints | null
  /** Nearest continent (cluster) for every book, derived once on load. */
  clusterOf: Uint8Array | null
  meta: (BookMeta | null)[]

  query: string
  results: number[]
  activeGenres: number[]
  era: Era

  alphas: Uint8Array
  alphaVersion: number
  visibleCount: number

  selectedId: number | null
  hoveredId: number | null
  pointer: { x: number; y: number } | null
  nearby: number[]
  nearbyLoading: boolean
  showNearby: boolean
  focus: Focus | null

  setManifest: (manifest: Manifest, clusters: Cluster[]) => void
  setPoints: (points: AtlasPoints, count: number) => void
  setMetaChunk: (start: number, books: BookMeta[]) => void
  setSearchIndexed: (count: number) => void
  setPhase: (phase: Phase) => void
  setError: (message: string) => void

  setQuery: (query: string) => void
  setResults: (ids: number[]) => void
  toggleGenre: (genre: number) => void
  setEra: (era: Era) => void
  resetFilters: () => void

  select: (id: number | null) => void
  hover: (id: number | null) => void
  setPointer: (pointer: { x: number; y: number } | null) => void
  toggleNearby: () => void
  flyToCluster: (clusterId: number) => void
  focusBook: (id: number) => void
  recompute: () => void
}

let focusNonce = 0

export const ERA_OPTIONS: { id: Era; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'pre1900', label: 'pre-1900' },
  { id: '1900s', label: '1900–59' },
  { id: '1960s', label: '1960–99' },
  { id: '2000s', label: '2000s' },
]

function buildAlphas(state: AtlasState): { alphas: Uint8Array; visibleCount: number } {
  const { count, points, query, results, activeGenres, era, selectedId, nearby } = state
  const alphas = new Uint8Array(count).fill(255)
  if (!points || count === 0) return { alphas, visibleCount: 0 }

  const hasQuery = query.trim().length > 0
  const resultSet = results.length ? new Set(results) : null
  const genreSet = activeGenres.length ? new Set(activeGenres) : null
  let visibleCount = 0

  for (let i = 0; i < count; i++) {
    const matches =
      (!genreSet || genreSet.has(points.attrs.genre[i])) &&
      inEra(points.attrs.year[i], era) &&
      (!hasQuery || (resultSet ? resultSet.has(i) : false))
    if (matches) visibleCount++
    else alphas[i] = DIM_ALPHA
  }

  // The selected book and its nearest neighbours stay legible regardless of filters.
  if (selectedId != null && selectedId < count) alphas[selectedId] = 255
  for (const id of nearby) if (id < count) alphas[id] = 255

  return { alphas, visibleCount }
}

function apply(state: AtlasState, partial: Partial<AtlasState>): Partial<AtlasState> {
  const merged = { ...state, ...partial }
  const { alphas, visibleCount } = buildAlphas(merged)
  return { ...partial, alphas, visibleCount, alphaVersion: state.alphaVersion + 1 }
}

export const useAtlas = create<AtlasState>()((set, get) => ({
  phase: 'boot',
  error: null,
  manifest: null,
  genres: [],
  clusters: [],
  count: 0,
  metaLoaded: 0,
  searchIndexed: 0,
  points: null,
  clusterOf: null,
  meta: [],

  query: '',
  results: [],
  activeGenres: [],
  era: 'all',

  alphas: new Uint8Array(0),
  alphaVersion: 0,
  visibleCount: 0,

  selectedId: null,
  hoveredId: null,
  pointer: null,
  nearby: [],
  nearbyLoading: false,
  showNearby: false,
  focus: null,

  setManifest: (manifest, clusters) =>
    set({
      manifest,
      clusters,
      genres: manifest.genres,
      phase: 'loading',
      error: null,
    }),

  setPoints: (points, count) =>
    set((state) => {
      const clusterOf = new Uint8Array(count)
      for (let i = 0; i < count; i++) {
        const x = points.positions[i * 3]
        const y = points.positions[i * 3 + 1]
        const z = points.positions[i * 3 + 2]
        let best = 0
        let bestDist = Infinity
        for (const cluster of state.clusters) {
          const dx = x - cluster.centroid[0]
          const dy = y - cluster.centroid[1]
          const dz = z - cluster.centroid[2]
          const dist = dx * dx + dy * dy + dz * dz
          if (dist < bestDist) {
            bestDist = dist
            best = cluster.id
          }
        }
        clusterOf[i] = best
      }
      const meta = new Array<BookMeta | null>(count).fill(null)
      return apply(state, {
        points,
        count,
        clusterOf,
        meta,
        metaLoaded: state.metaLoaded,
      })
    }),

  setMetaChunk: (start, books) =>
    set((state) => {
      if (!state.meta.length) return {}
      const meta = state.meta.slice()
      for (let i = 0; i < books.length; i++) {
        if (start + i < meta.length) meta[start + i] = books[i]
      }
      return { meta, metaLoaded: Math.min(meta.length, state.metaLoaded + books.length) }
    }),

  setSearchIndexed: (count) => set({ searchIndexed: count }),
  setPhase: (phase) => set({ phase }),
  setError: (message) => set({ phase: 'error', error: message }),

  setQuery: (query) =>
    set((state) => {
      if (!query.trim()) return apply(state, { query, results: [] })
      return { query }
    }),

  setResults: (ids) => set((state) => apply(state, { results: ids })),

  toggleGenre: (genre) =>
    set((state) =>
      apply(state, {
        activeGenres: state.activeGenres.includes(genre)
          ? state.activeGenres.filter((g) => g !== genre)
          : [...state.activeGenres, genre],
      }),
    ),

  setEra: (era) => set((state) => apply(state, { era })),

  resetFilters: () =>
    set((state) => apply(state, { query: '', results: [], activeGenres: [], era: 'all' })),

  select: (id) => {
    set((state) =>
      apply(state, {
        selectedId: id,
        nearby: [],
        nearbyLoading: id != null,
        showNearby: id == null ? false : state.showNearby,
      }),
    )
    if (id == null) return
    atlas
      .neighbors(id)
      .then((ids) => {
        const state = get()
        if (state.selectedId !== id) return
        set((current) => apply(current, { nearby: ids.slice(0, 10), nearbyLoading: false }))
      })
      .catch(() => set({ nearbyLoading: false }))
  },

  hover: (id) =>
    set((state) => (state.hoveredId === id ? {} : { hoveredId: id })),

  setPointer: (pointer) => set({ pointer }),

  toggleNearby: () => set((state) => ({ showNearby: !state.showNearby })),

  flyToCluster: (clusterId) => {
    const cluster = get().clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    focusNonce += 1
    set({
      focus: {
        dir: cluster.centroid,
        distance: 3.15,
        nonce: focusNonce,
      },
    })
  },

  focusBook: (id) => {
    const { points } = get()
    if (!points || id < 0 || id * 3 + 2 >= points.positions.length) return
    const x = points.positions[id * 3]
    const y = points.positions[id * 3 + 1]
    const z = points.positions[id * 3 + 2]
    const len = Math.hypot(x, y, z) || 1
    focusNonce += 1
    set({
      focus: { dir: [x / len, y / len, z / len], distance: 3.05, nonce: focusNonce },
    })
  },

  recompute: () => set((state) => apply(state, {})),
}))
