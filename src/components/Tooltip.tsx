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

  const width = 240
  const left = Math.min(Math.max(pointer.x + 16, 12), Math.max(12, viewport.width - width - 12))
  const top = Math.min(Math.max(pointer.y - 18, 12), Math.max(12, viewport.height - 96))
  const genre = meta ? genres[meta.g] : null

  return (
    <div
      role="status"
      className="pointer-events-none fixed z-50 px-4 py-2.5"
      style={{
        left,
        top,
        width,
        borderRadius: 'var(--radius-2)',
        backgroundImage: 'linear-gradient(145deg, #F6F8FB, #E6EAF1)',
        boxShadow: 'var(--shadow-raised)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {meta ? (
        <>
          <p className="font-serif truncate text-[14px] leading-tight text-ink">{meta.t}</p>
          <p className="muted mt-0.5 truncate text-[12px]">
            {meta.a} · {meta.y}
          </p>
          {genre ? (
            <p className="muted mt-1 flex items-center gap-1.5 text-[12px]">
              <span
                className="genre-dot h-2 w-2"
                style={{ background: genre.color }}
                aria-hidden
              />
              {genre.name}
            </p>
          ) : null}
        </>
      ) : (
        <p className="muted text-[12px]">Loading metadata…</p>
      )}
    </div>
  )
}
