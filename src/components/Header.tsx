import { useEffect, useRef, useState } from 'react'
import { useAtlas } from '../store/atlas'
import { atlas } from '../workers/atlasClient'
import BlurText from './bits/BlurText'
import CountUp from './bits/CountUp'

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
  const selectedId = useAtlas((state) => state.selectedId)
  const select = useAtlas((state) => state.select)
  const focusBook = useAtlas((state) => state.focusBook)
  const autoRotate = useAtlas((state) => state.autoRotate)
  const showLabels = useAtlas((state) => state.showLabels)
  const showLinks = useAtlas((state) => state.showLinks)
  const toggleAutoRotate = useAtlas((state) => state.toggleAutoRotate)
  const toggleLabels = useAtlas((state) => state.toggleLabels)
  const toggleLinks = useAtlas((state) => state.toggleLinks)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [settingsOpen])

  return (
    <header className="app-header card header-inner">
      <div className="brand">
        <BrandMark />
        <div className="min-w-0">
          <h1 className="brand-title truncate">
            <BlurText text="Book Similarity Machine" />
          </h1>
          <p className="brand-sub">A clay atlas of reading</p>
        </div>
      </div>

      <div className="search-wrap">
        <label htmlFor="atlas-search" className="sr-only">
          Search books, authors or subjects
        </label>
        <div className="search-field surface-inset">
          <svg
            viewBox="0 0 24 24"
            className="search-icon h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
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
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="btn btn-ghost btn-icon -mr-1 h-8 w-8 min-h-8 min-w-8"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <span className="search-kbd" data-pulse={count > 0} aria-hidden>
              /
            </span>
          )}
        </div>

        {showResults ? (
          <div className="search-pop card thin-scrollbar">
            {results.length ? (
              <ul className="space-y-0.5">
                {results.slice(0, 7).map((id) => {
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
                        className="result-row"
                        data-active={id === selectedId}
                      >
                        <span
                          className="genre-dot h-2.5 w-2.5"
                          style={{ background: genres[book?.g ?? 0]?.color ?? '#c9d1dd' }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] text-ink">
                            {book?.t ?? `Book #${id}`}
                          </span>
                          <span className="muted block truncate text-[12px]">
                            {book ? `${book.a} · ${book.y}` : 'loading metadata…'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted px-3 py-4 text-[13px]">
                {searchIndexed < count && count > 0
                  ? `Indexing ${searchIndexed.toLocaleString()} of ${count.toLocaleString()} books…`
                  : 'No books match that search.'}
              </p>
            )}
            <p className="eyebrow px-3 pb-1 pt-2">{results.length.toLocaleString()} matches</p>
          </div>
        ) : null}
      </div>

      <div className="header-right">
        <div className="count-chip surface-raised tabular">
          <strong>
            <CountUp value={count} />
          </strong>
          <span className="hidden sm:inline">books</span>
        </div>

        <div className="settings-wrap" ref={settingsRef}>
          <button
            type="button"
            aria-label="Globe settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
            className={`btn btn-icon ${settingsOpen ? 'surface-inset' : 'btn-raised'}`}
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="12" r="3.1" />
              <path
                d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2M6.1 6.1l1.4 1.4M16.5 16.5l1.4 1.4M6.1 17.9l1.4-1.4M16.5 7.5l1.4-1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {settingsOpen ? (
            <div className="settings-pop card">
              <p className="eyebrow px-2 pb-1">View</p>
              <ToggleRow label="Rotate slowly" value={autoRotate} onChange={toggleAutoRotate} />
              <ToggleRow label="Labels" value={showLabels} onChange={toggleLabels} />
              <ToggleRow label="Threads" value={showLinks} onChange={toggleLinks} />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: () => void
}) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={onChange} className="settings-row">
      <span>{label}</span>
      <span
        aria-hidden
        className="relative h-5 w-9 rounded-full transition-colors"
        style={{
          background: value
            ? 'linear-gradient(145deg, #7A68E8, #5B49D4)'
            : 'linear-gradient(145deg, #E1E5EC, #F2F4F8)',
          boxShadow: value
            ? '0 4px 10px rgba(91,73,212,.3)'
            : 'inset 3px 3px 6px var(--dark), inset -3px -3px 6px var(--light)',
        }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </span>
    </button>
  )
}

function BrandMark() {
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
      style={{
        background: 'linear-gradient(145deg, #F7F9FC, #E0E4EB)',
        boxShadow:
          '6px 6px 14px var(--dark), -6px -6px 14px var(--light), inset 1px 1px 0 rgba(255,255,255,.9)',
      }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <circle cx="9.4" cy="10" r="1.7" fill="#B9AEF0" />
        <circle cx="14.4" cy="8.4" r="1.25" fill="#A9CDF0" />
        <circle cx="15.2" cy="13.6" r="1.9" fill="#F2B6CC" />
        <circle cx="10.4" cy="14.8" r="1.3" fill="#F5CFA0" />
        <circle cx="12.4" cy="11.8" r="1" fill="#A8DCC3" />
      </svg>
    </span>
  )
}
