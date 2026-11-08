import type { PackedAttrs } from './types'

/** World-space radius of the clay globe. Positions are stored as unit vectors. */
export const SPHERE_RADIUS = 2

/** Bump footprints (world units) interpolated by popularity. */
export const BUMP = {
  minRadius: 0.0115,
  maxRadius: 0.0295,
  minHeight: 0.006,
  maxHeight: 0.021,
} as const

/** Alpha used for bumps excluded by search or filters (0-255). */
export const DIM_ALPHA = 26

export function decodePositions(buffer: ArrayBuffer, count: number): Float32Array {
  const view = new Uint16Array(buffer)
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i++) out[i] = (view[i] / 65535) * 2 - 1
  return out
}

export function decodeAttrs(buffer: ArrayBuffer, count: number): PackedAttrs {
  const bytes = new Uint8Array(buffer)
  const genre = new Uint8Array(count)
  const popularity = new Uint8Array(count)
  const year = new Uint16Array(count)
  const dv = new DataView(buffer)
  for (let i = 0; i < count; i++) {
    genre[i] = bytes[i * 4]
    popularity[i] = bytes[i * 4 + 1]
    year[i] = dv.getUint16(i * 4 + 2, true)
  }
  return { genre, popularity, year }
}

export function decodeNeighbors(buffer: ArrayBuffer, count: number, k: number): Uint32Array {
  const view = new Uint32Array(buffer)
  const out = new Uint32Array(count * k)
  out.set(view.subarray(0, Math.min(view.length, out.length)))
  return out
}

export function bumpSize(popularity: number): { radius: number; height: number } {
  const t = Math.pow(Math.min(1, Math.max(0, popularity / 255)), 0.62)
  return {
    radius: BUMP.minRadius + (BUMP.maxRadius - BUMP.minRadius) * t,
    height: BUMP.minHeight + (BUMP.maxHeight - BUMP.minHeight) * t,
  }
}

export function inEra(year: number, era: string): boolean {
  switch (era) {
    case 'pre1900':
      return year < 1900
    case '1900s':
      return year >= 1900 && year < 1960
    case '1960s':
      return year >= 1960 && year < 2000
    case '2000s':
      return year >= 2000
    default:
      return true
  }
}

export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(dataUrl(path))
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`)
  return (await res.json()) as T
}

export async function fetchBuffer(path: string): Promise<ArrayBuffer> {
  const res = await fetch(dataUrl(path))
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`)
  return res.arrayBuffer()
}
