import { useEffect, useRef } from 'react'
import { ERA_OPTIONS, useAtlas } from '../store/atlas'
import { atlas } from '../workers/atlasClient'

export default function Header() {
  const inputRef = useRef<HTMLInputElement>(null)
  const query = useAtlas((state) => state.query)
  const setQuery = useAtlas((state) => state.setQuery)
  const setResults = useAtlas((state) => state.setResults)
  const results = useAtlas((state) => state.results)
  const meta = useAtlas((state) => state.meta)
  const searchIndexed = useAtlas((state) => state.searchIndexed)
  const count = useAtlas((state) => state.count)
  const genres = useAtlas((state) => state.genres)
  const activeGenres = useAtlas((state) => state.activeGenres)
  const era = useAtlas((state) => state.era)
  const selectedId = useAtlas((state) => state.selectedId)
  const toggleGenre = useAtlas((state) => state.toggleGenre)
  const setEra = useAtlas((state) => state.setEra)
  const resetFilters = useAtlas((state) => state.resetFilters)
  const select = useAtlas((state) => state.select)
  const focusBook = useAtlas((state) => state.focusBook)
  const filterActive = activeGenres.length > 0 || era !== 'all' || query.trim().length > 0
  const showResults = query.trim().length > 0

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      atlas
        .search(trimmed)
        .then((ids) => {
          if (!cancelled) setResults(ids)
        })
        .catch(() => {})
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, searchIndexed, setResults])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA)$/.test(target.tagName)
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape' && typing) inputRef.current?.blur()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const topResults = results.slice(0, 7)

  return (
    <header className="pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-col gap-2.5 sm:inset-x-4 sm:top-4">
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <div className="clay pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-full py-2 pl-2 pr-3.5 sm:gap-3 sm:pr-5">
          <BrandMark />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[15px] leading-none tracking-[-0.01em] text-ink sm:text-[18px]">
              Book Similarity Machine
            </h1>
            <p className="mt-1 hidden text-[9px] uppercase tracking-[0.18em] text-soft sm:block">
              a clay atlas of reading
            </p>
          </div>
        </div>

        <div className="pointer-events-auto relative min-w-0 flex-1 sm:max-w-[420px]">
          <label htmlFor="atlas-search" className="sr-only">
            Search books, authors or subjects
          </label>
          <div className="clay-inset relative flex h-11 items-center rounded-full">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-4 h-4 w-4 text-soft"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
            >
              <circle cx="10.8" cy="10.8" r="6.3" />
              <path d="m15.5 15.5 4 4" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              id="atlas-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search books, authors, moods…"
              autoComplete="off"
              spellCheck={false}
              className="h-full w-full rounded-full bg-transparent pl-11 pr-10 text-[13px] text-ink placeholder:text-soft/70 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="absolute right-2.5 grid h-7 w-7 place-items-center rounded-full text-soft transition-colors hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3.5 hidden rounded-md border border-[#d9dfe8] px-1.5 py-0.5 text-[10px] text-soft sm:block">
                /
              </span>
            )}
          </div>

          {showResults ? (
            <div className="clay absolute left-0 right-0 top-[calc(100%+10px)] z-40 rounded-[22px] p-2">
              {topResults.length ? (
                <ul className="thin-scrollbar max-h-[46vh] overflow-y-auto">
                  {topResults.map((id) => {
                    const book = meta[id]
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => {
                            select(id)
                            focusBook(id)
                            inputRef.current?.blur()
                          }}
                          className={`flex w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-white/45 ${
                            id === selectedId ? 'bg-white/40' : ''
                          }`}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background:
                                genres[book?.g ?? 0]?.color ?? '#c9d1dd',
                              boxShadow: 'inset 1px 1px 2px rgba(255,255,255,.8)',
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-ink">
                              {book?.t ?? `Book #${id}`}
                            </span>
                            <span className="block truncate text-[11px] text-soft">
                              {book ? `${book.a} · ${book.y}` : 'loading metadata…'}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="px-3 py-4 text-[12px] text-soft">
                  {searchIndexed < count && count > 0
                    ? `Indexing ${searchIndexed.toLocaleString()} of ${count.toLocaleString()} books…`
                    : 'No books match that search.'}
                </p>
              )}
              <p className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.16em] text-soft/80">
                {results.length.toLocaleString()} matches · others fade on the globe
              </p>
            </div>
          ) : null}
        </div>

        <div className="clay pointer-events-auto hidden shrink-0 rounded-full px-4 py-2.5 text-center text-[11px] leading-tight text-soft lg:block">
          <span className="block font-serif text-[17px] leading-none text-ink">
            {count.toLocaleString()}
          </span>
          books
        </div>
      </div>

      <div className="clay pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-full px-2 py-1.5 no-scrollbar sm:gap-2 sm:px-2.5">
        {genres.map((genre, index) => {
          const active = activeGenres.includes(index)
          return (
            <button
              key={genre.id}
              type="button"
              onClick={() => toggleGenre(index)}
              aria-pressed={active}
              className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] transition-colors ${
                active ? 'clay-inset-sm text-[#4a3fa8]' : 'clay-sm text-ink hover:text-[#4a3fa8]'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: genre.color,
                  boxShadow: 'inset 1px 1px 2px rgba(255,255,255,.85)',
                }}
              />
              <span className="hidden sm:inline">{genre.name}</span>
              <span className="sm:hidden">{genre.name.split(' ')[0]}</span>
            </button>
          )
        })}

        <span className="mx-1 h-4 w-px shrink-0 bg-[#d7dde6]" />

        {ERA_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setEra(option.id)}
            aria-pressed={era === option.id}
            className={`h-7 shrink-0 rounded-full px-2.5 text-[11px] transition-colors ${
              era === option.id ? 'clay-inset-sm text-[#4a3fa8]' : 'text-soft hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}

        {filterActive ? (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto h-7 shrink-0 rounded-full px-2.5 text-[11px] text-soft underline decoration-[#c8d0dc] underline-offset-2 hover:text-ink"
          >
            Reset
          </button>
        ) : null}
      </div>
    </header>
  )
}

function BrandMark() {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10"
      style={{
        background: 'radial-gradient(circle at 34% 28%, #ffffff 0%, #e6eaf1 55%, #c9d0db 100%)',
        boxShadow:
          'inset 1px 1px 2px rgba(255,255,255,0.9), inset -2px -2px 4px rgba(120,132,152,0.35), 3px 3px 8px rgba(160,170,188,0.55)',
      }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <circle cx="9.4" cy="10" r="1.7" fill="#b9aef0" />
        <circle cx="14.4" cy="8.4" r="1.25" fill="#a9cdf0" />
        <circle cx="15.2" cy="13.6" r="1.9" fill="#f2b6cc" />
        <circle cx="10.4" cy="14.8" r="1.3" fill="#f5cfa0" />
        <circle cx="12.4" cy="11.8" r="1" fill="#a8dcc3" />
      </svg>
    </span>
  )
}
