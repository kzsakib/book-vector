/** Clay palette shared by CSS tokens and the 3D scene. */
export const PALETTE = {
  canvas: '#E9ECF1',
  ink: '#2B3440',
  ink2: '#4F5B69',
  soft: '#4F5B69',
  accent: '#5B49D4',
  light: '#FFFFFF',
  dark: '#C5CCD7',
  globe: '#E6EAF0',
  limb: '#C9CFDA',
} as const

/** Pastel genre tints, in manifest genre order. Dots and tags only — never text. */
export const GENRE_TINTS = [
  '#A599E8', // Fantasy
  '#8DBBE6', // Science fiction
  '#E99BB8', // Romance
  '#E6BC84', // Mystery
  '#86CDB0', // Literary
  '#D98F8F', // Horror
  '#98A8E6', // History
  '#C4B2E4', // Poetry
] as const

export const BG_HEX = PALETTE.canvas

export function genreTint(index: number): string {
  if (!Number.isFinite(index) || index < 0) return '#CBD3DE'
  return GENRE_TINTS[index % GENRE_TINTS.length]
}

/** Blend a tint toward white so domes stay pastel rather than saturated. */
export function pastel(hex: string, amount = 0.85): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const mix = (channel: number) => Math.round(channel * amount + 255 * (1 - amount))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
