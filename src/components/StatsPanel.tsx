import { useMemo } from 'react'
import { useAtlas } from '../store/atlas'
import AnimatedContent from './bits/AnimatedContent'
import CountUp from './bits/CountUp'

const START_YEAR = 1800
const END_YEAR = 2026
const BIN = 5

/** Left rail: genre rows and one histogram range slider. */
export default function StatsPanel() {
  const genres = useAtlas((state) => state.genres)
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const activeGenres = useAtlas((state) => state.activeGenres)
  const toggleGenre = useAtlas((state) => state.toggleGenre)
  const yearRange = useAtlas((state) => state.yearRange)
  const setYearRange = useAtlas((state) => state.setYearRange)
  const resetFilters = useAtlas((state) => state.resetFilters)
  const filterActive = useAtlas(
    (state) =>
      state.activeGenres.length > 0 ||
      state.yearRange[0] > START_YEAR ||
      state.yearRange[1] < END_YEAR ||
      state.query.trim().length > 0,
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

  const histogram = useMemo(() => {
    const bins = new Array<number>(Math.ceil((END_YEAR - START_YEAR) / BIN)).fill(0)
    if (!points) return { bins, max: 1 }
    for (let i = 0; i < count; i++) {
      const year = points.attrs.year[i]
      if (year < START_YEAR || year > END_YEAR) continue
      bins[Math.min(bins.length - 1, Math.floor((year - START_YEAR) / BIN))]++
    }
    return { bins, max: Math.max(1, ...bins) }
  }, [points, count])

  if (!genres.length) return null

  const [low, high] = yearRange
  const pct = (year: number) => ((year - START_YEAR) / (END_YEAR - START_YEAR)) * 100
  const presets: { id: string; label: string; range: [number, number] }[] = [
    { id: 'all', label: 'All', range: [START_YEAR, END_YEAR] },
    { id: 'pre1900', label: 'Pre-1900', range: [START_YEAR, 1899] },
    { id: '2000s', label: '2000+', range: [2000, END_YEAR] },
  ]

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
                aria-pressed={active}
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
        <div className="card-head">
          <p className="eyebrow">Decade</p>
          <span className="range-readout tabular">
            {low} to {high}
          </span>
        </div>

        <div className="histogram" aria-hidden>
          {histogram.bins.map((value, index) => {
            const from = START_YEAR + index * BIN
            const inRange = from + BIN > low && from <= high
            return (
              <span
                key={from}
                className="histogram-bar"
                data-active={inRange}
                style={{ height: `${Math.max(6, (value / histogram.max) * 100)}%` }}
              />
            )
          })}
        </div>

        <div className="range-wrap">
          <div className="range-track" aria-hidden />
          <div
            className="range-fill"
            aria-hidden
            style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }}
          />
          <input
            className="range-input"
            type="range"
            min={START_YEAR}
            max={END_YEAR}
            step={1}
            value={low}
            aria-label="Earliest publication year"
            onChange={(event) =>
              setYearRange([Math.min(Number(event.target.value), high - 1), high])
            }
          />
          <input
            className="range-input"
            type="range"
            min={START_YEAR}
            max={END_YEAR}
            step={1}
            value={high}
            aria-label="Latest publication year"
            onChange={(event) =>
              setYearRange([low, Math.max(Number(event.target.value), low + 1)])
            }
          />
        </div>

        <div className="preset-row">
          {presets.map((preset) => {
            const active = low === preset.range[0] && high === preset.range[1]
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => setYearRange(preset.range)}
                className="preset-chip"
                data-active={active}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </AnimatedContent>
    </aside>
  )
}
