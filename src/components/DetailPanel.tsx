import { useAtlas } from '../store/atlas'
import { initials, rgba } from '../lib/color'
import { genreTint } from '../lib/theme'
import AnimatedContent from './bits/AnimatedContent'
import AnimatedList from './bits/AnimatedList'
import BlurText from './bits/BlurText'
import CountUp from './bits/CountUp'
import Magnet from './bits/Magnet'

/** Right rail: selected book on top, nearby books docked beneath it. */
export default function DetailPanel() {
  const selectedId = useAtlas((state) => state.selectedId)
  const meta = useAtlas((state) =>
    state.selectedId == null ? null : state.meta[state.selectedId],
  )
  const genres = useAtlas((state) => state.genres)
  const nearby = useAtlas((state) => state.nearby)
  const nearbyLoading = useAtlas((state) => state.nearbyLoading)
  const allMeta = useAtlas((state) => state.meta)
  const select = useAtlas((state) => state.select)
  const focusBook = useAtlas((state) => state.focusBook)
  const flyToCluster = useAtlas((state) => state.flyToCluster)
  const clusterOf = useAtlas((state) => state.clusterOf)
  const clusters = useAtlas((state) => state.clusters)
  const count = useAtlas((state) => state.count)

  const colour = meta ? genreTint(meta.g) : '#B9AEF0'
  const genre = meta ? genres[meta.g] : null
  const cluster =
    selectedId != null && clusterOf ? clusters[clusterOf[selectedId]] : null

  const neighbours = nearby
    .slice(0, 10)
    .filter((id) => id !== selectedId)
    .map((id) => ({ id, book: allMeta[id] }))

  return (
    <aside className="rail-right" data-has-selection={selectedId != null}>
      <AnimatedContent className="card selected-card">
        {selectedId == null ? (
          <>
            <p className="eyebrow">Selected book</p>
            <p className="mt-3 font-serif text-[20px] leading-snug text-ink">
              Pick a book on the globe
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-soft">
              Every bump is a book. Drag to rotate, scroll to zoom, or click a bump to read it and
              see the ten books closest to it.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b9aef0]" aria-hidden />
              <CountUp value={count} /> books, {clusters.length} regions
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="eyebrow">Selected book</p>
              <button
                type="button"
                onClick={() => select(null)}
                aria-label="Close book details"
                className="clay-sm -mt-1 grid h-8 w-8 place-items-center rounded-full text-soft hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex gap-3">
              <div
                className="cover"
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
                <h2 className="font-serif text-[20px] leading-tight text-ink">
                  {meta ? <BlurText key={selectedId} text={meta.t} /> : null}
                </h2>
                {meta ? (
                  <p className="mt-1 text-[12px] text-soft">
                    {meta.a} · {meta.y}
                  </p>
                ) : (
                  <div className="mt-2 h-3 w-3/5 animate-pulse rounded-full bg-[#dde3ec]" />
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {genre ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] text-ink/80"
                      style={{ background: rgba(colour, 0.3) }}
                    >
                      {genre.name}
                    </span>
                  ) : null}
                  {cluster ? <span className="chip">{cluster.name}</span> : null}
                </div>
              </div>
            </div>

            {meta?.s?.length ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {meta.s.slice(0, 4).map((subject) => (
                  <span key={subject} className="chip">
                    {subject}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2">
              <Magnet className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedId != null) focusBook(selectedId)
                  }}
                  className="clay-sm h-9 w-full rounded-full text-[12px] text-ink hover:text-[#4a3fa8]"
                >
                  Show nearby books
                </button>
              </Magnet>
              <Magnet className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    if (cluster) flyToCluster(cluster.id)
                  }}
                  disabled={!cluster}
                  className="clay-sm h-9 w-full rounded-full text-[12px] text-ink hover:text-[#4a3fa8] disabled:opacity-45"
                >
                  Zoom to cluster
                </button>
              </Magnet>
            </div>
          </>
        )}
      </AnimatedContent>

      <AnimatedContent className="card nearby-card" delay={0.06}>
        <div className="flex items-baseline justify-between gap-2 px-1">
          <p className="eyebrow">Nearby books</p>
          <span className="text-[10px] tabular-nums text-soft">
            {selectedId == null ? '—' : nearbyLoading ? '·' : neighbours.length}
          </span>
        </div>

        {selectedId == null ? (
          <p className="px-1 pt-3 text-[11.5px] leading-relaxed text-soft">
            Choose a book and its ten nearest neighbours appear here, threaded to it on the globe.
          </p>
        ) : nearbyLoading ? (
          <p className="px-1 pt-3 text-[11px] text-soft">Reading the neighbour graph…</p>
        ) : neighbours.length ? (
          <AnimatedList
            ariaLabel="Nearby books"
            className="nearby-list thin-scrollbar"
            items={neighbours.map((entry) => ({
              id: entry.id,
              content: (
                <div className="flex items-center gap-2">
                  <span
                    className="h-7 w-[20px] shrink-0 rounded-[4px]"
                    style={{
                      background: `linear-gradient(150deg, ${rgba(genreTint(entry.book?.g ?? 0), 0.9)}, ${rgba(
                        genreTint(entry.book?.g ?? 0),
                        0.45,
                      )})`,
                      boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.8)',
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-ink">
                      {entry.book?.t ?? `Book #${entry.id}`}
                    </span>
                    <span className="block truncate text-[10px] text-soft">
                      {entry.book ? `${entry.book.a} · ${entry.book.y}` : 'metadata pending'}
                    </span>
                  </span>
                </div>
              ),
            }))}
            onSelect={(id) => {
              select(id)
              focusBook(id)
            }}
          />
        ) : (
          <p className="px-1 pt-3 text-[11px] text-soft">No neighbours found for this book.</p>
        )}
      </AnimatedContent>
    </aside>
  )
}
