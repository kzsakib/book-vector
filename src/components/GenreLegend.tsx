import { useMemo } from 'react'
import { useAtlas } from '../store/atlas'

/** Genre key, bottom-left. Clicking a genre toggles its filter. */
export default function GenreLegend() {
  const genres = useAtlas((state) => state.genres)
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const activeGenres = useAtlas((state) => state.activeGenres)
  const toggleGenre = useAtlas((state) => state.toggleGenre)

  const counts = useMemo(() => {
    const totals = new Array<number>(genres.length).fill(0)
    if (!points) return totals
    for (let i = 0; i < count; i++) {
      const genre = points.attrs.genre[i]
      if (genre < totals.length) totals[genre]++
    }
    return totals
  }, [genres.length, points, count])

  if (!genres.length) return null

  return (
    <section
      aria-label="Genres"
      className="clay pointer-events-auto absolute bottom-4 left-3 z-20 hidden w-[186px] rounded-[24px] p-4 md:block md:left-4"
    >
      <p className="mb-2.5 text-[9px] uppercase tracking-[0.2em] text-soft">Genres</p>
      <ul className="space-y-1">
        {genres.map((genre, index) => {
          const active = activeGenres.includes(index)
          const dimmed = activeGenres.length > 0 && !active
          return (
            <li key={genre.id}>
              <button
                type="button"
                onClick={() => toggleGenre(index)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2 rounded-full px-1.5 py-1 text-[11px] transition-opacity hover:bg-white/40 ${
                  dimmed ? 'opacity-55' : 'opacity-100'
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    background: genre.color,
                    boxShadow: active
                      ? 'inset 2px 2px 3px rgba(120,110,170,.45), inset -1px -1px 2px rgba(255,255,255,.8)'
                      : 'inset 1px 1px 2px rgba(255,255,255,.85), 2px 2px 4px rgba(170,180,196,.5)',
                  }}
                />
                <span className={`flex-1 truncate text-left ${active ? 'text-[#4a3fa8]' : 'text-ink'}`}>
                  {genre.name}
                </span>
                <span className="tabular-nums text-[10px] text-soft">
                  {counts[index]?.toLocaleString() ?? '—'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
