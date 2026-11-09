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
  const selectedCluster = selectedId != null && clusterOf ? clusterOf[selectedId] : null

  const neighbours = nearby
    .slice(0, 10)
    .filter((id) => id !== selectedId)
    .map((id) => ({
      id,
      book: allMeta[id],
      near: selectedCluster != null && clusterOf ? clusterOf[id] === selectedCluster : true,
    }))

  return (
    <aside className="rail-right" data-has-selection={selectedId != null}>
      <AnimatedContent className="card selected-card">
        {selectedId == null ? (
          <>
            <p className="eyebrow">Selected book</p>
            <p className="font-serif mt-3 text-[20px] leading-snug text-ink">
              Pick a book on the globe
            </p>
            <p className="empty-state">
              Every bump is a book. Drag to rotate, scroll to zoom, or click a bump to read it and
              see the ten books closest to it.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="genre-dot h-1.5 w-1.5 bg-[#b9aef0]" aria-hidden />
              <span className="eyebrow tabular">
                <CountUp value={count} /> books · {clusters.length} regions
              </span>
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
                {meta ? (
                  <h2 className="font-serif text-[20px] leading-tight text-ink">
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
                      <span
                        className="tag-dot"
                        style={{ background: colour }}
                        aria-hidden
                      />
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
                  <span key={subject} className="chip">
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
              <Magnet className="w-full">
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
              </Magnet>
            </div>
          </>
        )}
      </AnimatedContent>

      <AnimatedContent className="card nearby-card" delay={0.06}>
        <div className="card-head">
          <p className="eyebrow">Nearby books</p>
          <span className="genre-count">
            {selectedId == null ? '—' : nearbyLoading ? '·' : neighbours.length}
          </span>
        </div>

        {selectedId == null ? (
          <p className="empty-state">
            Choose a book and its ten nearest neighbours appear here, threaded to it on the globe.
          </p>
        ) : nearbyLoading ? (
          <div className="mt-3 flex flex-col gap-3" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3">
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
            items={neighbours.map((entry) => ({
              id: entry.id,
              content: (
                <>
                  <span
                    className="cover cover-sm"
                    style={{
                      background: `linear-gradient(150deg, ${rgba(genreTint(entry.book?.g ?? 0), 0.9)}, ${rgba(
                        genreTint(entry.book?.g ?? 0),
                        0.45,
                      )})`,
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
                  </span>
                  <span className="distance-chip">{entry.near ? 'Near' : 'Other region'}</span>
                </>
              ),
            }))}
            onSelect={(id) => {
              select(id)
              focusBook(id)
            }}
          />
        ) : (
          <p className="empty-state">No neighbours found for this book.</p>
        )}
      </AnimatedContent>
    </aside>
  )
}
