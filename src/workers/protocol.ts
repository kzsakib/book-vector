import type { BookMeta } from '../data/types'

export type WorkerRequest =
  | {
      type: 'init'
      positions: Float32Array
      neighbors: Uint32Array
      count: number
      k: number
      radius: number
    }
  | { type: 'meta'; start: number; books: BookMeta[] }
  | { type: 'search'; reqId: number; query: string }
  | {
      type: 'pick'
      reqId: number
      origin: [number, number, number]
      dir: [number, number, number]
      threshold: number
    }
  | { type: 'neighbors'; reqId: number; id: number }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'indexed'; count: number }
  | { type: 'search'; reqId: number; ids: number[] }
  | { type: 'pick'; reqId: number; id: number | null }
  | { type: 'neighbors'; reqId: number; ids: number[] }
