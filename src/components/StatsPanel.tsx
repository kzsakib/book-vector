import { useMemo, type CSSProperties, type KeyboardEvent } from 'react'
import { ERA_OPTIONS, useAtlas } from '../store/atlas'
import AnimatedContent from './bits/AnimatedContent'
import CountUp from './bits/CountUp'

/** Left rail: one Genres card (multi-select) and one segmented Decade control. */
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

  const eraIndex = Math.max(0, ERA_OPTIONS.findIndex((option) => option.id === era))

  const onEraKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = (eraIndex + delta + ERA_OPTIONS.length) % ERA_OPTIONS.length
    setEra(ERA_OPTIONS[next].id)
  }

  return (
    <aside className="rail-left" aria-label="Filters">
      <AnimatedContent className="card card-pad genres-card">
        <div className="card-head">
          <p className="eyebrow">Genres</p>
          {filterActive ? (
            <button type="button" onClick={resetFilters} className="btn btn-ghost btn-sm px-2">
              Reset
            </button>
          ) : null}
        </div>

        <div className="genre-list" role="group" aria-label="Genres">
          {genres.map((genre, index) => {
            const active = activeGenres.includes(index)
            const dimmed = activeGenres.length > 0 && !active
            return (
              <button
                key={genre.id}
                type="button"
                role="checkbox"
                aria-checked={active}
                data-active={active}
                data-dimmed={dimmed}
                onClick={() => toggleGenre(index)}
                className="genre-row"
              >
                <span className="genre-dot" style={{ background: genre.color }} aria-hidden />
                <span className="flex-1 truncate">{genre.name}</span>
                <span className="genre-count">
                  <CountUp value={counts[index] ?? 0} />
                </span>
              </button>
            )
          })}
        </div>
      </AnimatedContent>

      <AnimatedContent className="card card-pad decade-card" delay={0.05}>
        <p className="eyebrow mb-2">Decade</p>
        <div
          className="segmented segmented-vertical"
          role="radiogroup"
          aria-label="Decade"
          onKeyDown={onEraKeyDown}
          style={{ '--i': eraIndex, '--n': ERA_OPTIONS.length } as CSSProperties}
        >
          <span className="segmented-thumb" aria-hidden />
          {ERA_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={era === option.id}
              tabIndex={era === option.id ? 0 : -1}
              onClick={() => setEra(option.id)}
              className="segment"
            >
              {option.label}
            </button>
          ))}
        </div>
      </AnimatedContent>
    </aside>
  )
}
