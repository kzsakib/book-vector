import * as THREE from 'three'

const scratch = new THREE.Vector3()

/**
 * Similarity shown in the UI. Positions are unit vectors produced by the
 * projection, so their dot product is the angular proximity on the globe and a
 * faithful stand-in for the embedding cosine at this level of detail.
 */
export function cosineBetween(
  positions: Float32Array,
  a: number,
  b: number,
): number {
  const ax = positions[a * 3]
  const ay = positions[a * 3 + 1]
  const az = positions[a * 3 + 2]
  const bx = positions[b * 3]
  const by = positions[b * 3 + 1]
  const bz = positions[b * 3 + 2]
  const dot = ax * bx + ay * by + az * bz
  const la = Math.hypot(ax, ay, az) || 1
  const lb = Math.hypot(bx, by, bz) || 1
  return dot / (la * lb)
}

/** Great-circle angle in degrees between two books on the globe. */
export function angleBetween(
  positions: Float32Array,
  a: number,
  b: number,
): number {
  return THREE.MathUtils.radToDeg(
    Math.acos(Math.min(1, Math.max(-1, cosineBetween(positions, a, b)))),
  )
}

export function isOtherRegion(
  positions: Float32Array,
  a: number,
  b: number,
): boolean {
  return angleBetween(positions, a, b) > 60
}

/** Map a cosine to a 0–100 score for the ring badges. */
export function similarityScore(cosine: number): number {
  return Math.round(Math.min(0.99, Math.max(0.05, cosine)) * 100)
}

/**
 * Scores for one selection's neighbour list. The embedding cosine is almost
 * saturated after the 3D projection, so the list is scored on relative
 * great-circle distance: the closest neighbour reads 99, the farthest of the
 * ten about 72.
 */
export function neighbourScores(
  positions: Float32Array,
  selectedId: number,
  ids: number[],
): number[] {
  const angles = ids.map((id) => angleBetween(positions, selectedId, id))
  const max = Math.max(...angles, 0.0001)
  return angles.map((angle) => Math.round(99 - (angle / max) * 27))
}

export function unitOf(positions: Float32Array, id: number): THREE.Vector3 {
  return scratch
    .set(positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2])
    .normalize()
    .clone()
}
