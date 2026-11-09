import { useAtlas } from '../store/atlas'
import { genreTint } from '../lib/theme'

/** Hover card: title, author and genre, pinned to the pointer. */
export default function Tooltip() {
  const hoveredId = useAtlas((state) => state.hoveredId)
  const selectedId = useAtlas((state) => state.selectedId)
  const pointer = useAtlas((state) => state.pointer)
  const meta = useAtlas((state) => (state.hoveredId == null ? null : state.meta[state.hoveredId]))
  const genres = useAtlas((state) => state.genres)

  // The selected book already carries a label card; avoid stacking two.
  if (hoveredId == null || !pointer || hoveredId === selectedId) return null

  const genre = meta ? genres[meta.g] : null
  const colour = meta ? genreTint(meta.g) : '#8E7CF0'

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[240px] rounded-[16px] bg-white/95 px-3 py-2 shadow-[0_6px_20px_rgba(70,82,110,0.18)]"
      style={{
        left: Math.min(pointer.x + 16, (globalThis.innerWidth ?? 1200) - 256),
        top: Math.min(pointer.y + 16, (globalThis.innerHeight ?? 800) - 96),
      }}
      role="status"
    >
      <p className="font-serif text-[14px] leading-snug text-ink">
        {meta?.t ?? `Book #${hoveredId}`}
      </p>
      <p className="mt-0.5 text-[12px] text-ink-2">
        {meta ? `${meta.a} · ${meta.y}` : 'metadata pending'}
      </p>
      {genre ? (
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: colour }}
            aria-hidden
          />
          {genre.name}
        </p>
      ) : null}
    </div>
  )
}
