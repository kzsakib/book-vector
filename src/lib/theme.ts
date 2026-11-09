/** Clay palette shared by CSS tokens and the 3D scene. */
export const PALETTE = {
  canvas: '#E9ECF1',
  ink: '#2B3440',
  ink2: '#4F5B69',
  soft: '#4F5B69',
  accent: '#5B49D4',
  light: '#FFFFFF',
  dark: '#C5CCD7',
  globe: '#DDE2EA',
  limb: '#C9CFDA',
} as const

/**
 * Genre tints, in manifest genre order. Dots and tags only — never text.
 * Saturated enough to stay readable as 8px spheres on a pale surface.
 */
export const GENRE_TINTS = [
  '#8E7CF0', // Fantasy
  '#5FA8E8', // Science fiction
  '#F07BA8', // Romance
  '#F2B35A', // Mystery
  '#55C79A', // Literary
  '#E26A6A', // Horror
  '#6F86E8', // History
  '#B79CE6', // Poetry
] as const

export const BG_HEX = PALETTE.canvas

export function genreTint(index: number): string {
  if (!Number.isFinite(index) || index < 0) return '#CBD3DE'
  return GENRE_TINTS[index % GENRE_TINTS.length]
}

/** Blend a tint toward white so secondary surfaces stay pastel. */
export function pastel(hex: string, amount = 0.85): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const mix = (channel: number) => Math.round(channel * amount + 255 * (1 - amount))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
