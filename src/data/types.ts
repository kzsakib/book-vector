export interface Genre {
  id: string
  name: string
  color: string
}

export interface Manifest {
  version: number
  generatedAt: string
  source: string
  count: number
  chunkSize: number
  chunks: number
  neighbors: number
  sphereRadius: number
  genres: Genre[]
}

export interface Cluster {
  id: number
  name: string
  genre: number
  color: string
  count: number
  terms: string[]
  centroid: [number, number, number]
}

export interface ClusterFile {
  generatedAt: string
  radius: number
  clusters: Cluster[]
}

/** Compact per-book metadata as exported by the pipeline (meta-*.json chunks). */
export interface BookMeta {
  t: string
  a: string
  y: number
  g: number
  p: number
  s: string[]
  /** Optional CDN cover id, present in real datasets. */
  c?: string
}

export interface PackedAttrs {
  genre: Uint8Array
  popularity: Uint8Array
  year: Uint16Array
}

export interface AtlasPoints {
  positions: Float32Array
  attrs: PackedAttrs
  neighbors: Uint32Array
}

export type Era = 'all' | 'pre1900' | '1900s' | '1960s' | '2000s' | 'custom'

export interface Focus {
  dir: [number, number, number]
  /** Camera distance as a fraction of the framed distance (1 = framed). */
  zoom: number
  /** Changes on every request so identical directions still animate. */
  nonce: number
}
