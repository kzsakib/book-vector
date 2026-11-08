/// <reference lib="webworker" />
import MiniSearch from 'minisearch'
import type { BookMeta } from '../data/types'
import type { WorkerRequest, WorkerResponse } from './protocol'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (message: WorkerResponse) => void
}

interface SearchDoc {
  id: number
  t: string
  a: string
  s: string
}

interface IndexableBook extends BookMeta {
  id: number
}

let positions: Float32Array | null = null
let neighbors: Uint32Array | null = null
let count = 0
let k = 20
let radius = 2
let tree: KdTree | null = null

let index: MiniSearch<SearchDoc> | null = null
let indexed = 0
const indexedIds = new Set<number>()

function addToIndex(books: IndexableBook[]) {
  if (!index) {
    index = new MiniSearch<SearchDoc>({
      fields: ['t', 'a', 's'],
      idField: 'id',
      tokenize: (text) => text.split(/[\s,;:()[\]{}'"/\\|!?._–—-]+/).filter(Boolean),
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { t: 3, a: 2 },
      },
    })
  }
  // Metadata chunks can be re-sent after a dev reload or worker restart;
  // MiniSearch throws on duplicate ids, so only add unseen books.
  const fresh = books.filter((book) => !indexedIds.has(book.id))
  if (!fresh.length) return
  for (const book of fresh) indexedIds.add(book.id)
  index.addAll(fresh as unknown as SearchDoc[])
  indexed += fresh.length
}

/**
 * Axis-aligned kd-tree over the bump centres. Querying a ray against boxes keeps
 * picking off the GPU and independent of instance count.
 */
class KdTree {
  private readonly idx: Uint32Array
  private readonly centres: Float32Array
  private readonly axis: Int8Array
  private readonly split: Float32Array
  private readonly left: Int32Array
  private readonly right: Int32Array
  private readonly start: Uint32Array
  private readonly length: Uint32Array
  private readonly box: Float32Array
  private nodeCount = 0
  private readonly maxNodes: number

  constructor(centres: Float32Array, count: number) {
    this.centres = centres
    this.idx = new Uint32Array(count)
    for (let i = 0; i < count; i++) this.idx[i] = i
    this.maxNodes = Math.max(1, count * 2 + 1)
    this.axis = new Int8Array(this.maxNodes)
    this.split = new Float32Array(this.maxNodes)
    this.left = new Int32Array(this.maxNodes)
    this.right = new Int32Array(this.maxNodes)
    this.start = new Uint32Array(this.maxNodes)
    this.length = new Uint32Array(this.maxNodes)
    this.box = new Float32Array(this.maxNodes * 6)
    if (count > 0) this.build(0, count)
  }

  private build(lo: number, hi: number): number {
    const node = this.nodeCount++
    this.left[node] = -1
    this.right[node] = -1
    this.start[node] = lo
    this.length[node] = 0

    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let maxZ = -Infinity
    for (let i = lo; i < hi; i++) {
      const p = this.idx[i] * 3
      const x = this.centres[p]
      const y = this.centres[p + 1]
      const z = this.centres[p + 2]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
    }
    const b = node * 6
    this.box[b] = minX
    this.box[b + 1] = minY
    this.box[b + 2] = minZ
    this.box[b + 3] = maxX
    this.box[b + 4] = maxY
    this.box[b + 5] = maxZ

    if (hi - lo <= 8) {
      this.length[node] = hi - lo
      return node
    }

    const ex = maxX - minX
    const ey = maxY - minY
    const ez = maxZ - minZ
    const axis = ex > ey ? (ex > ez ? 0 : 2) : ey > ez ? 1 : 2
    const slice = this.idx.subarray(lo, hi)
    const c = this.centres
    slice.sort((a, b2) => c[a * 3 + axis] - c[b2 * 3 + axis])

    const mid = (lo + hi) >> 1
    this.axis[node] = axis
    this.split[node] = c[this.idx[mid] * 3 + axis]
    this.left[node] = this.build(lo, mid)
    this.right[node] = this.build(mid, hi)
    return node
  }

  pick(
    origin: [number, number, number],
    dir: [number, number, number],
    threshold: number,
    maxRadius: number,
  ): number | null {
    if (!this.nodeCount) return null
    const c = this.centres
    const stack = new Int32Array(64)
    let top = 0
    stack[top++] = 0
    let bestId = -1
    let bestT = Infinity

    while (top > 0) {
      const node = stack[--top]
      if (this.boxDistance(node, origin, dir) > threshold) continue

      if (this.length[node] > 0) {
        for (let i = this.start[node]; i < this.start[node] + this.length[node]; i++) {
          const id = this.idx[i]
          const px = c[id * 3]
          const py = c[id * 3 + 1]
          const pz = c[id * 3 + 2]
          // Only the hemisphere facing the camera is pickable.
          if (px * origin[0] + py * origin[1] + pz * origin[2] <= 0) continue
          const vx = px - origin[0]
          const vy = py - origin[1]
          const vz = pz - origin[2]
          const t = vx * dir[0] + vy * dir[1] + vz * dir[2]
          if (t <= 0 || t >= bestT) continue
          const dx = vx - dir[0] * t
          const dy = vy - dir[1] * t
          const dz = vz - dir[2] * t
          const perpSq = dx * dx + dy * dy + dz * dz
          const reach = threshold * (0.55 + 0.45 * Math.min(1, maxRadius / 0.03))
          if (perpSq > reach * reach) continue
          bestT = t
          bestId = id
        }
      } else {
        if (this.left[node] >= 0) {
          if (top >= stack.length) break
          stack[top++] = this.left[node]
        }
        if (this.right[node] >= 0) {
          if (top >= stack.length) break
          stack[top++] = this.right[node]
        }
      }
    }
    return bestId >= 0 ? bestId : null
  }

  private boxDistance(
    node: number,
    origin: [number, number, number],
    dir: [number, number, number],
  ): number {
    const b = node * 6
    let tmin = -Infinity
    let tmax = Infinity
    for (let axis = 0; axis < 3; axis++) {
      const d = dir[axis]
      if (Math.abs(d) < 1e-8) {
        if (origin[axis] < this.box[b + axis] || origin[axis] > this.box[b + 3 + axis]) {
          return Infinity
        }
        continue
      }
      const inv = 1 / d
      let t1 = (this.box[b + axis] - origin[axis]) * inv
      let t2 = (this.box[b + 3 + axis] - origin[axis]) * inv
      if (t1 > t2) {
        const tmp = t1
        t1 = t2
        t2 = tmp
      }
      if (t1 > tmin) tmin = t1
      if (t2 < tmax) tmax = t2
      if (tmin > tmax) return Infinity
    }
    if (tmax < 0) return Infinity
    const t = Math.max(0, tmin)
    const px = origin[0] + dir[0] * t
    const py = origin[1] + dir[1] * t
    const pz = origin[2] + dir[2] * t
    let distSq = 0
    for (let axis = 0; axis < 3; axis++) {
      const lo = this.box[b + axis]
      const hi = this.box[b + 3 + axis]
      const p = axis === 0 ? px : axis === 1 ? py : pz
      if (p < lo) distSq += (lo - p) ** 2
      else if (p > hi) distSq += (p - hi) ** 2
    }
    return Math.sqrt(distSq)
  }
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  switch (message.type) {
    case 'init': {
      positions = message.positions
      neighbors = message.neighbors
      count = message.count
      k = message.k
      radius = message.radius
      const centres = new Float32Array(count * 3)
      for (let i = 0; i < count * 3; i++) centres[i] = positions[i] * radius
      tree = new KdTree(centres, count)
      scope.postMessage({ type: 'ready' })
      if (indexed) scope.postMessage({ type: 'indexed', count: indexed })
      break
    }

    case 'meta': {
      const docs: IndexableBook[] = message.books.map((book, i) => ({
        id: message.start + i,
        ...book,
      }))
      addToIndex(docs)
      scope.postMessage({ type: 'indexed', count: indexed })
      break
    }

    case 'search': {
      if (!index || !message.query.trim()) {
        scope.postMessage({ type: 'search', reqId: message.reqId, ids: [] })
        break
      }
      const hits = index.search(message.query, { prefix: true, fuzzy: 0.2 })
      const ids: number[] = []
      for (const hit of hits) if (ids.length < 4000) ids.push(hit.id as number)
      scope.postMessage({ type: 'search', reqId: message.reqId, ids })
      break
    }

    case 'pick': {
      const id = tree ? tree.pick(message.origin, message.dir, message.threshold, radius) : null
      scope.postMessage({ type: 'pick', reqId: message.reqId, id })
      break
    }

    case 'neighbors': {
      if (!neighbors || message.id < 0 || message.id >= count) {
        scope.postMessage({ type: 'neighbors', reqId: message.reqId, ids: [] })
        break
      }
      const ids: number[] = []
      const base = message.id * k
      for (let i = 0; i < k; i++) ids.push(neighbors[base + i])
      scope.postMessage({ type: 'neighbors', reqId: message.reqId, ids })
      break
    }

    default:
      break
  }
}
