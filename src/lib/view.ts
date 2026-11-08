/**
 * Mutable render-loop state shared between the canvas, DOM labels and the
 * control dock. Kept out of React state so zoom updates never re-render.
 */
export const atlasView = {
  /** Camera distance divided by the framed distance; 1 = fully zoomed out. */
  zoom: 1,
  /** Distance at which the globe radius is 0.42 * min(canvas width, height). */
  baseDistance: 0,
}

type ViewCommand = (factor: number) => void

const commands = {
  zoom: null as ViewCommand | null,
  reset: null as (() => void) | null,
}

export function registerViewCommands(next: { zoom: ViewCommand; reset: () => void }) {
  commands.zoom = next.zoom
  commands.reset = next.reset
}

export function zoomBy(factor: number) {
  commands.zoom?.(factor)
}

export function resetView() {
  commands.reset?.()
}
