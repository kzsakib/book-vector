import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { resetView, zoomBy } from '../lib/view'
import { useAtlas } from '../store/atlas'
import ClickSpark from './bits/ClickSpark'
import Dock, { type DockItem } from './bits/Dock'
import DecryptedText from './bits/DecryptedText'

const GlobeScene = lazy(() => import('./GlobeScene'))

export default function GlobeStage() {
  const phase = useAtlas((state) => state.phase)
  const count = useAtlas((state) => state.count)
  const showLabels = useAtlas((state) => state.showLabels)
  const showLinks = useAtlas((state) => state.showLinks)
  const toggleLabels = useAtlas((state) => state.toggleLabels)
  const toggleLinks = useAtlas((state) => state.toggleLinks)
  const selectedId = useAtlas((state) => state.selectedId)
  const meta = useAtlas((state) => (state.selectedId == null ? null : state.meta[state.selectedId]))
  const nearby = useAtlas((state) => state.nearby)
  const select = useAtlas((state) => state.select)
  const focusBook = useAtlas((state) => state.focusBook)
  const allMeta = useAtlas((state) => state.meta)

  const [touched, setTouched] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveIndex(0)
  }, [selectedId])

  const items: DockItem[] = [
    { id: 'zoom-in', label: 'Zoom in', icon: <IconZoomIn />, active: true, onClick: () => zoomBy(1.22) },
    { id: 'zoom-out', label: 'Zoom out', icon: <IconZoomOut />, active: true, onClick: () => zoomBy(1 / 1.22) },
    { id: 'reset', label: 'Reset view', icon: <IconReset />, active: true, onClick: resetView },
    {
      id: 'labels',
      label: showLabels ? 'Hide labels' : 'Show labels',
      icon: <IconLabel />,
      active: showLabels,
      onClick: toggleLabels,
    },
    {
      id: 'links',
      label: showLinks ? 'Hide threads' : 'Show threads',
      icon: <IconThread />,
      active: showLinks,
      onClick: toggleLinks,
    },
  ]

  const announcement =
    selectedId != null
      ? `Selected ${meta?.t ?? `book ${selectedId}`}, ${nearby.length || 10} similar books`
      : 'No book selected'

  /** Visually hidden listbox so keyboard and screen-reader users can pick a book. */
  const options = useMemo(() => {
    const ids = nearby.length ? nearby.slice(0, 10) : []
    return ids.map((id) => ({ id, title: allMeta[id]?.t ?? `Book #${id}` }))
  }, [nearby, allMeta])

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!options.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + delta + options.length) % options.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[Math.min(activeIndex, options.length - 1)]
      select(option.id)
      focusBook(option.id)
    }
  }

  return (
    <section
      className="stage"
      id="atlas-globe"
      tabIndex={-1}
      aria-label="Book globe"
      onPointerDownCapture={() => setTouched(true)}
      onKeyDownCapture={() => setTouched(true)}
    >
      <div className="stage-shadow" aria-hidden />

      <ClickSpark className="stage-canvas">
        <Suspense fallback={null}>
          <GlobeScene />
        </Suspense>
      </ClickSpark>

      <ClusterFlash />

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* Keyboard equivalent of clicking a bump. */}
      <div className="sr-only">
        <p id="globe-list-label">
          Books near the selected book. Use the arrow keys, then Enter to open one.
        </p>
        <div
          ref={listRef}
          role="listbox"
          aria-labelledby="globe-list-label"
          tabIndex={0}
          onKeyDown={onListKeyDown}
          onFocus={() => setTouched(true)}
          className="outline-none"
        >
          {options.length ? (
            options.map((option, index) => (
              <div
                key={option.id}
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex}
                onClick={() => {
                  select(option.id)
                  focusBook(option.id)
                }}
              >
                {option.title}
              </div>
            ))
          ) : (
            <p>Pick a book on the globe to list its neighbours here.</p>
          )}
        </div>
      </div>

      <div className="stage-footer">
        <Dock items={items} />
        <p className="stage-hint" data-touched={touched}>
          Drag to rotate · scroll to zoom · click a dot
        </p>
        <p className="stage-legend" data-visible={selectedId != null}>
          Lines connect the most similar books. Similar books can sit in other regions.
        </p>
      </div>

      {phase !== 'ready' && count >= 0 ? (
        <div className="stage-status surface-raised" aria-live="polite">
          <span className="genre-dot h-2 w-2 animate-pulse bg-[#7A68E8]" aria-hidden />
          {count && count > 0 ? 'Streaming books onto the globe…' : 'Unrolling the atlas…'}
        </div>
      ) : null}
    </section>
  )
}

/** The continent the camera is flying to, decrypted as it travels. */
function ClusterFlash() {
  const flash = useAtlas((state) => state.clusterFlash)
  const [shown, setShown] = useState<{ name: string; nonce: number } | null>(null)

  useEffect(() => {
    if (!flash) return
    setShown(flash)
    const timer = window.setTimeout(() => setShown(null), 2800)
    return () => window.clearTimeout(timer)
  }, [flash])

  if (!shown) return null

  return (
    <div className="cluster-flash" role="status" aria-live="polite">
      <DecryptedText key={shown.nonce} text={shown.name} speed={24} />
    </div>
  )
}

function IconZoomIn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M10.8 8v5.6M8 10.8h5.6M15.4 15.4 20 20" strokeLinecap="round" />
    </svg>
  )
}

function IconZoomOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M8 10.8h5.6M15.4 15.4 20 20" strokeLinecap="round" />
    </svg>
  )
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3" strokeLinecap="round" />
      <path d="M4.4 5.2v4.2h4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLabel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4.6 6.6h9.2M4.6 11.4h14.8M4.6 16.2h7.2" strokeLinecap="round" />
    </svg>
  )
}

function IconThread() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="6" cy="7" r="1.9" />
      <circle cx="18" cy="10.5" r="1.9" />
      <circle cx="9.5" cy="17.5" r="1.9" />
      <path d="m7.6 8.2 8.6 1.6M8.2 16.2l8-4.2M7.1 8.9l1.8 6.7" strokeLinecap="round" />
    </svg>
  )
}
