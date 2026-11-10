import { useEffect, useMemo, useRef } from 'react'
import { useAtlas } from '../store/atlas'
import { initials, rgba } from '../lib/color'
import { genreTint } from '../lib/theme'
import { angleBetween, neighbourScores } from '../lib/similarity'
import AnimatedContent from './bits/AnimatedContent'
import AnimatedList from './bits/AnimatedList'
import BlurText from './bits/BlurText'
import CountUp from './bits/CountUp'
import Magnet from './bits/Magnet'

/** Right rail: starter card when idle, selected book plus ranked neighbours after. */
export default function DetailPanel() {
  const selectedId = useAtlas((state) => state.selectedId)
  const meta = useAtlas((state) => (state.selectedId == null ? null : state.meta[state.selectedId]))
  const genres = useAtlas((state) => state.genres)
  const nearby = useAtlas((state) => state.nearby)
  const nearbyLoading = useAtlas((state) => state.nearbyLoading)
  const allMeta = useAtlas((state) => state.meta)
  const points = useAtlas((state) => state.points)
  const count = useAtlas((state) => state.count)
  const select = useAtlas((state) => state.select)
  const focusBook = useAtlas((state) => state.focusBook)
  const flyToCluster = useAtlas((state) => state.flyToCluster)
  const clusterOf = useAtlas((state) => state.clusterOf)
  const clusters = useAtlas((state) => state.clusters)
  const hoveredId = useAtlas((state) => state.hoveredId)
  const hover = useAtlas((state) => state.hover)
  const listRef = useRef<HTMLDivElement>(null)

  const colour = meta ? genreTint(meta.g) : '#8E7CF0'
  const genre = meta ? genres[meta.g] : null
  const cluster = selectedId != null && clusterOf ? clusters[clusterOf[selectedId]] : null

  const neighbours = useMemo(() => {
    if (selectedId == null || !points) return []
    const ids = nearby.filter((id) => id !== selectedId).slice(0, 10)
    const scores = neighbourScores(points.positions, selectedId, ids)
    return ids.map((id, index) => ({
      id,
      rank: index + 1,
      book: allMeta[id],
      other: angleBetween(points.positions, selectedId, id) > 60,
      score: scores[index] ?? 90,
    }))
  }, [nearby, selectedId, points, allMeta])

  // Hovering a dot scrolls its row into view and highlights it.
  useEffect(() => {
    if (hoveredId == null || selectedId == null) return
    const node = listRef.current?.querySelector<HTMLElement>(`[data-book-row="${hoveredId}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [hoveredId, selectedId])

  const starters = useMemo(() => {
    if (!points) return []
    const ids = Array.from({ length: count }, (_, i) => i)
    ids.sort((a, b) => points.attrs.popularity[b] - points.attrs.popularity[a])
    return ids.slice(0, 3)
  }, [points, count])

  const surprise = () => {
    if (!points || !count) return
    const id = Math.floor(Math.random() * count)
    select(id)
    focusBook(id)
  }

  const mostPopular = () => {
    if (!starters.length) return
    select(starters[0])
    focusBook(starters[0])
  }

  return (
    <aside className="rail-right" data-has-selection={selectedId != null}>
      <AnimatedContent className="card selected-card">
        {selectedId == null ? (
          <>
            <p className="eyebrow">Start here</p>
            <h2 className="font-serif mt-2 text-[22px] leading-tight text-ink">Pick a book</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              Choose any dot and the globe keeps only its ten closest neighbours in view.
            </p>

            <div className="starter-list">
              {starters.map((id) => {
                const book = allMeta[id]
                const tint = genreTint(points?.attrs.genre[id] ?? 0)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      select(id)
                      focusBook(id)
                    }}
                    className="starter-row"
                  >
                    <span
                      className="cover cover-sm"
                      style={{ background: `linear-gradient(150deg, ${rgba(tint, 0.92)}, ${rgba(tint, 0.5)})` }}
                      aria-hidden
                    >
                      {initials(book?.t ?? '')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] leading-tight text-ink">
                        {book?.t ?? `Book #${id}`}
                      </span>
                      <span className="block truncate text-[13px] text-ink-2">
                        {book ? `${book.a} · ${book.y}` : 'metadata pending'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Magnet className="w-full">
                <button type="button" onClick={surprise} className="btn btn-primary w-full">
                  Surprise me
                </button>
              </Magnet>
              <button type="button" onClick={mostPopular} className="btn btn-raised w-full">
                Most popular
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="card-head">
              <p className="eyebrow">Selected book</p>
              <button
                type="button"
                onClick={() => select(null)}
                aria-label="Close book details"
                className="close-btn -mt-1"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex gap-4">
              <div
                className="cover cover-lg"
                style={{
                  background: `linear-gradient(150deg, ${rgba(colour, 0.95)}, ${rgba(colour, 0.52)})`,
                }}
              >
                {meta?.c ? (
                  <img src={meta.c} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{initials(meta?.t ?? '')}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {meta ? (
                  <h2 className="font-serif text-[22px] leading-tight text-ink">
                    <BlurText key={selectedId} text={meta.t} />
                  </h2>
                ) : (
                  <div className="flex flex-col gap-2 pt-1" aria-hidden>
                    <span className="skeleton h-4 w-4/5" />
                    <span className="skeleton h-4 w-2/3" />
                  </div>
                )}
                {meta ? (
                  <p className="muted mt-1 text-[14px]">
                    {meta.a} · {meta.y}
                  </p>
                ) : (
                  <span className="skeleton mt-2 block h-3 w-3/5" aria-hidden />
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {genre ? (
                    <span className="tag">
                      <span className="tag-dot" style={{ background: colour }} aria-hidden />
                      {genre.name}
                    </span>
                  ) : null}
                  {cluster ? <span className="tag">{cluster.name}</span> : null}
                </div>
              </div>
            </div>

            {meta?.s?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {meta.s.slice(0, 4).map((subject) => (
                  <span key={subject} className="tag tag-subject">
                    {subject}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              <Magnet className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedId != null) focusBook(selectedId)
                  }}
                  className="btn btn-primary w-full"
                >
                  Show nearby books
                </button>
              </Magnet>
              <button
                type="button"
                onClick={() => {
                  if (cluster) flyToCluster(cluster.id)
                }}
                disabled={!cluster}
                className="btn btn-raised w-full"
              >
                Zoom to cluster
              </button>
            </div>
          </>
        )}
      </AnimatedContent>

      {selectedId != null ? (
        <AnimatedContent className="card nearby-card" delay={0.06}>
          <div className="card-head">
            <p className="eyebrow">Nearby books</p>
            <span className="genre-count">{nearbyLoading ? '·' : neighbours.length}</span>
          </div>

          <div ref={listRef} className="min-h-0 flex-1">
            {nearbyLoading ? (
              <div className="mt-3 flex flex-col gap-3" aria-hidden>
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <span className="skeleton h-10 w-10 rounded-full" />
                    <span className="skeleton h-14 w-10 rounded-[8px]" />
                    <span className="flex-1">
                      <span className="skeleton block h-3.5 w-3/4" />
                      <span className="skeleton mt-2 block h-3 w-1/2" />
                    </span>
                  </div>
                ))}
                <p className="sr-only">Reading the neighbour graph…</p>
              </div>
            ) : neighbours.length ? (
              <AnimatedList
                ariaLabel="Nearby books"
                className="nearby-list thin-scrollbar"
                rowClassName="nearby-row"
                highlightId={hoveredId}
                items={neighbours.map((entry) => ({
                  id: entry.id,
                  content: (
                    <>
                      <span className="rank-badge" aria-hidden>
                        {entry.rank}
                      </span>
                      <span
                        className="cover cover-sm"
                        style={{
                          background: `linear-gradient(150deg, ${rgba(
                            genreTint(entry.book?.g ?? 0),
                            0.9,
                          )}, ${rgba(genreTint(entry.book?.g ?? 0), 0.45)})`,
                        }}
                        aria-hidden
                      >
                        {initials(entry.book?.t ?? '')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] leading-tight text-ink">
                          {entry.book?.t ?? `Book #${entry.id}`}
                        </span>
                        <span className="muted block truncate text-[12px]">
                          {entry.book ? `${entry.book.a} · ${entry.book.y}` : 'metadata pending'}
                        </span>
                        {entry.other ? <span className="distance-chip">Other region</span> : null}
                      </span>
                      <SimilarityRing score={entry.score} />
                    </>
                  ),
                }))}
                onSelect={(id) => {
                  select(id)
                  focusBook(id)
                }}
                onHover={(id) => hover(id)}
              />
            ) : (
              <p className="empty-state">No neighbours found for this book.</p>
            )}
          </div>
        </AnimatedContent>
      ) : null}
    </aside>
  )
}

function SimilarityRing({ score }: { score: number }) {
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  return (
    <span className="sim-ring" role="img" aria-label={`${score} percent similar`}>
      <svg viewBox="0 0 32 32" aria-hidden>
        <circle cx="13" cy="13" r={radius} className="sim-ring-track" />
        <circle
          cx="13"
          cy="13"
          r={radius}
          className="sim-ring-fill"
          strokeDasharray={`${filled} ${circumference}`}
          transform="rotate(-90 13 13)"
        />
      </svg>
      <span className="sim-ring-value tabular">
        <CountUp value={score} />
      </span>
    </span>
  )
}
