/** Clay palette shared by CSS tokens and the 3D scene. */
export const PALETTE = {
  canvas: '#E9ECF1',
  ink: '#37424E',
  soft: '#5A6675',
  light: '#FFFFFF',
  dark: '#C4CBD6',
  globe: '#E4E8EE',
} as const

/** Pastel genre tints, in manifest genre order. */
export const GENRE_TINTS = [
  '#B9AEF0', // Fantasy
  '#A9CDF0', // Science fiction
  '#F2B6CC', // Romance
  '#F5CFA0', // Mystery
  '#A8DCC3', // Literary
  '#E3A6A6', // Horror
  '#B8C6F0', // History
  '#D6C8EB', // Poetry
] as const

export const BG_HEX = PALETTE.canvas

export function genreTint(index: number): string {
  if (!Number.isFinite(index) || index < 0) return '#CBD3DE'
  return GENRE_TINTS[index % GENRE_TINTS.length]
}
