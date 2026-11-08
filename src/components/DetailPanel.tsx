import { useAtlas } from '../store/atlas'
import { initials, rgba } from '../lib/color'

/** Selected book detail + nearest neighbours, bottom-right. */
export default function DetailPanel() {
  const selectedId = useAtlas((state) => state.selectedId)
  const meta = useAtlas((state) => (state.selectedId == null ? null : state.meta[state.selectedId]))
  const genres = useAtlas((state) => state.genres)
  const nearby = useAtlas((state) => state.nearby)
  const nearbyLoading = useAtlas((state) => state.nearbyLoading)
  const showNearby = useAtlas((state) => state.showNearby)
  const allMeta = useAtlas((state) => state.meta)
  const select = useAtlas((state) => state.select)
  const toggleNearby = useAtlas((state) => state.toggleNearby)
  const focusBook = useAtlas((state) => state.focusBook)

  if (selectedId == null) {
    return (
      <aside className="clay pointer-events-auto absolute bottom-3 left-3 right-3 z-20 rounded-[26px] p-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[320px]">
        <p className="text-[9px] uppercase tracking-[0.2em] text-soft">Start exploring</p>
        <p className="mt-2 font-serif text-[19px] leading-snug text-ink">
          Every bump is a book. Similar books sit together.
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-soft">
          Drag to rotate, scroll to zoom, click a bump to open it, or double-click a continent
          to fly there.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {genres.slice(0, 5).map((genre) => (
            <span
              key={genre.id}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] text-soft"
              style={{ background: rgba(genre.color, 0.18) }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: genre.color }} />
              {genre.name}
            </span>
          ))}
        </div>
      </aside>
    )
  }

  const genre = meta ? genres[meta.g] : null
  const colour = genre?.color ?? '#b9aef0'
  const neighbours = nearby
    .slice(0, 8)
    .map((id) => ({ id, book: allMeta[id] }))
    .filter((entry) => entry.id !== selectedId)

  return (
    <aside className="clay pointer-events-auto absolute bottom-3 left-3 right-3 z-20 flex max-h-[62vh] flex-col rounded-[26px] p-4 sm:left-auto sm:right-4 sm:bottom-4 sm:max-h-[68vh] sm:w-[332px]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.2em] text-soft">Selected book</p>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="Close book details"
          className="clay-sm -mt-1 grid h-7 w-7 place-items-center rounded-full text-soft hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2.5 flex gap-3">
        <div
          className="relative h-[84px] w-[60px] shrink-0 overflow-hidden rounded-[10px]"
          style={{
            background: `linear-gradient(150deg, ${rgba(colour, 0.95)}, ${rgba(colour, 0.52)})`,
            boxShadow:
              'inset 1px 1px 0 rgba(255,255,255,.85), inset -2px -2px 4px rgba(100,110,130,.18), 4px 6px 14px -6px rgba(95,107,128,.65)',
          }}
        >
          {meta?.c ? (
            <img
              src={meta.c}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-serif text-[19px] text-white/95">
              {initials(meta?.t ?? '')}
            </span>
          )}
          <span className="absolute inset-y-0 left-0 w-[3px] bg-white/35" />
        </div>

        <div className="min-w-0 flex-1">
          {meta ? (
            <>
              <h2 className="font-serif text-[20px] leading-tight text-ink">{meta.t}</h2>
              <p className="mt-1 text-[12px] text-soft">
                {meta.a} · {meta.y}
              </p>
            </>
          ) : (
            <>
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-[#dde3ec]" />
              <div className="mt-2 h-3 w-3/5 animate-pulse rounded-full bg-[#e3e8f0]" />
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {genre ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] text-ink/80"
                style={{ background: rgba(colour, 0.28) }}
              >
                {genre.name}
              </span>
            ) : null}
            {meta ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] text-soft" style={{ background: 'rgba(255,255,255,.55)' }}>
                popularity {meta.p}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {meta?.s?.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {meta.s.slice(0, 5).map((subject) => (
            <span
              key={subject}
              className="rounded-full bg-white/45 px-2 py-0.5 text-[10px] text-soft"
            >
              {subject}
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleNearby}
        aria-expanded={showNearby}
        className={`mt-3.5 h-9 w-full rounded-full text-[12px] transition-colors ${
          showNearby ? 'clay-inset-sm text-[#4a3fa8]' : 'clay-sm text-ink hover:text-[#4a3fa8]'
        }`}
      >
        {showNearby ? 'Hide nearby books' : 'Show nearby books'}
      </button>

      {showNearby ? (
        <div className="thin-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5">
          {nearbyLoading ? (
            <p className="px-1 py-2 text-[11px] text-soft">Reading the neighbour graph…</p>
          ) : neighbours.length ? (
            <ul className="space-y-1">
              {neighbours.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      select(entry.id)
                      focusBook(entry.id)
                    }}
                    className="flex w-full items-center gap-2 rounded-2xl px-1.5 py-1.5 text-left transition-colors hover:bg-white/45"
                  >
                    <span
                      className="h-6 w-[18px] shrink-0 rounded-[4px]"
                      style={{
                        background: `linear-gradient(150deg, ${rgba(colour, 0.9)}, ${rgba(colour, 0.45)})`,
                        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.8)',
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-ink">
                        {entry.book?.t ?? `Book #${entry.id}`}
                      </span>
                      <span className="block truncate text-[10px] text-soft">
                        {entry.book ? `${entry.book.a} · ${entry.book.y}` : 'metadata pending'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-2 text-[11px] text-soft">No neighbours found for this book.</p>
          )}
        </div>
      ) : null}
    </aside>
  )
}
