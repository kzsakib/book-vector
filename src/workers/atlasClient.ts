import type { BookMeta } from '../data/types'
import type { WorkerRequest, WorkerResponse } from './protocol'

type Resolver = (response: WorkerResponse) => void

/**
 * Thin typed wrapper around the atlas worker. The worker owns the search index,
 * the kd-tree used for picking and the precomputed neighbour lists.
 */
class AtlasClient {
  private worker: Worker | null = null
  private pending = new Map<number, Resolver>()
  private sequence = 1
  private indexedListeners = new Set<(count: number) => void>()
  private ready: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  private ensure(): Worker {
    if (this.worker) return this.worker
    this.worker = new Worker(new URL('./atlas.worker.ts', import.meta.url), { type: 'module' })
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve
    })
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      if (message.type === 'ready') {
        this.readyResolve?.()
        return
      }
      if (message.type === 'indexed') {
        for (const listener of this.indexedListeners) listener(message.count)
        return
      }
      const resolve = this.pending.get(message.reqId)
      if (resolve) {
        this.pending.delete(message.reqId)
        resolve(message)
      }
    }
    this.worker.onerror = (event) => {
      console.error('[atlas worker]', event.message)
    }
    return this.worker
  }

  onIndexed(listener: (count: number) => void): () => void {
    this.indexedListeners.add(listener)
    return () => this.indexedListeners.delete(listener)
  }

  init(
    positions: Float32Array,
    neighbors: Uint32Array,
    count: number,
    k: number,
    radius: number,
  ): void {
    const worker = this.ensure()
    const message: WorkerRequest = {
      type: 'init',
      positions,
      neighbors,
      count,
      k,
      radius,
    }
    worker.postMessage(message, [positions.buffer, neighbors.buffer])
  }

  addMeta(start: number, books: BookMeta[]): void {
    this.ensure().postMessage({ type: 'meta', start, books } satisfies WorkerRequest)
  }

  private request(
    build: (reqId: number) => WorkerRequest,
    fallback: WorkerResponse,
    timeoutMs = 4000,
  ): Promise<WorkerResponse> {
    const worker = this.ensure()
    const reqId = this.sequence++
    return new Promise<WorkerResponse>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId)
        resolve(fallback)
      }, timeoutMs)
      this.pending.set(reqId, (response) => {
        clearTimeout(timer)
        resolve(response)
      })
      worker.postMessage(build(reqId))
    })
  }

  async search(query: string): Promise<number[]> {
    if (!query.trim()) return []
    await this.ready
    const response = await this.request(
      (reqId) => ({ type: 'search', reqId, query }),
      { type: 'search', reqId: -1, ids: [] },
    )
    return response.type === 'search' ? response.ids : []
  }

  async pick(
    origin: [number, number, number],
    dir: [number, number, number],
    threshold: number,
  ): Promise<number | null> {
    if (!this.ready) return null
    await this.ready
    const response = await this.request(
      (reqId) => ({ type: 'pick', reqId, origin, dir, threshold }),
      { type: 'pick', reqId: -1, id: null },
    )
    return response.type === 'pick' ? response.id : null
  }

  async neighbors(id: number): Promise<number[]> {
    if (!this.ready) return []
    await this.ready
    const response = await this.request(
      (reqId) => ({ type: 'neighbors', reqId, id }),
      { type: 'neighbors', reqId: -1, ids: [] },
    )
    return response.type === 'neighbors' ? response.ids : []
  }
}

export const atlas = new AtlasClient()
