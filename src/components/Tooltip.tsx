import { useEffect, useState } from 'react'
import { useAtlas } from '../store/atlas'

/** Cursor tooltip for the hovered bump. */
export default function Tooltip() {
  const hoveredId = useAtlas((state) => state.hoveredId)
  const pointer = useAtlas((state) => state.pointer)
  const meta = useAtlas((state) => (state.hoveredId == null ? null : state.meta[state.hoveredId]))
  const genres = useAtlas((state) => state.genres)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  if (hoveredId == null || !pointer) return null

  const width = 232
  const left = Math.min(Math.max(pointer.x + 16, 12), Math.max(12, viewport.width - width - 12))
  const top = Math.min(Math.max(pointer.y - 18, 12), Math.max(12, viewport.height - 90))
  const genre = meta ? genres[meta.g] : null

  return (
    <div
      role="status"
      className="pointer-events-none fixed z-50 rounded-2xl px-3 py-2"
      style={{
        left,
        top,
        width,
        background: 'rgba(233, 236, 241, 0.94)',
        boxShadow:
          '6px 6px 14px rgba(196,203,214,0.8), -6px -6px 14px rgba(255,255,255,0.9)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {meta ? (
        <>
          <p className="truncate font-serif text-[14px] leading-tight text-ink">{meta.t}</p>
          <p className="mt-0.5 truncate text-[11px] text-soft">
            {meta.a} · {meta.y}
          </p>
          {genre ? (
            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-soft">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: genre.color }} />
              {genre.name}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[11px] text-soft">Loading metadata…</p>
      )}
    </div>
  )
}
