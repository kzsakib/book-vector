import { useMemo } from 'react'
import { ERA_OPTIONS, useAtlas } from '../store/atlas'
import AnimatedContent from './bits/AnimatedContent'
import CountUp from './bits/CountUp'
import GooeyNav from './bits/GooeyNav'

/** Left rail: one Genres card (multi-select) and one Decade control. */
export default function StatsPanel() {
  const genres = useAtlas((state) => state.genres)
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const activeGenres = useAtlas((state) => state.activeGenres)
  const toggleGenre = useAtlas((state) => state.toggleGenre)
  const era = useAtlas((state) => state.era)
  const setEra = useAtlas((state) => state.setEra)
  const resetFilters = useAtlas((state) => state.resetFilters)
  const filterActive = useAtlas(
    (state) =>
      state.activeGenres.length > 0 || state.era !== 'all' || state.query.trim().length > 0,
  )

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
    <aside className="rail-left" aria-label="Filters">
      <AnimatedContent className="card card-pad genres-card">
        <div className="flex items-baseline justify-between gap-2">
          <p className="eyebrow">Genres</p>
          {filterActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[10px] text-soft underline decoration-[#c8d0dc] underline-offset-2 hover:text-ink"
            >
              Reset
            </button>
          ) : null}
        </div>

        <div className="genre-list">
          {genres.map((genre, index) => {
            const active = activeGenres.includes(index)
            const dimmed = activeGenres.length > 0 && !active
            return (
              <button
                key={genre.id}
                type="button"
                aria-pressed={active}
                data-active={active}
                data-dimmed={dimmed}
                onClick={() => toggleGenre(index)}
                className="genre-row"
              >
                <span
                  className="genre-dot"
                  style={{
                    background: genre.color,
                    boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.85)',
                  }}
                  aria-hidden
                />
                <span className={`flex-1 truncate ${active ? 'text-[#4a3fa8]' : 'text-ink'}`}>
                  {genre.name}
                </span>
                <span className="tabular-nums text-[10px] text-soft">
                  <CountUp value={counts[index] ?? 0} />
                </span>
              </button>
            )
          })}
        </div>
      </AnimatedContent>

      <AnimatedContent className="card card-pad decade-card" delay={0.05}>
        <p className="eyebrow mb-2">Decade</p>
        <GooeyNav items={ERA_OPTIONS} value={era} onChange={setEra} label="Decade" />
      </AnimatedContent>
    </aside>
  )
}
