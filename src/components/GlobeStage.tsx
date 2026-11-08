import { Suspense, lazy, useEffect, useState } from 'react'
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
  const reduced = useReducedMotion()

  const items: DockItem[] = [
    {
      id: 'zoom-in',
      label: 'Zoom in',
      icon: <IconZoomIn />,
      active: true,
      onClick: () => zoomBy(1.22),
    },
    {
      id: 'zoom-out',
      label: 'Zoom out',
      icon: <IconZoomOut />,
      active: true,
      onClick: () => zoomBy(1 / 1.22),
    },
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

  return (
    <section className="stage" aria-label="Book globe">
      <ClickSpark className="stage-canvas">
        <Suspense fallback={null}>
          <GlobeScene />
        </Suspense>
      </ClickSpark>

      <ClusterFlash />

      <p className="stage-hint">drag · scroll · click a bump</p>

      <div className="stage-dock">
        <Dock items={items} />
      </div>

      {phase !== 'ready' && count >= 0 ? (
        <div className="stage-status clay-sm" aria-live="polite">
          <span
            className={`h-2 w-2 rounded-full bg-[#b9aef0] ${reduced ? '' : 'animate-pulse'}`}
            aria-hidden
          />
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

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function IconZoomIn() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M10.8 8v5.6M8 10.8h5.6M15.4 15.4 20 20" strokeLinecap="round" />
    </svg>
  )
}

function IconZoomOut() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M8 10.8h5.6M15.4 15.4 20 20" strokeLinecap="round" />
    </svg>
  )
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3" strokeLinecap="round" />
      <path d="M4.4 5.2v4.2h4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLabel() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4.6 6.6h9.2M4.6 11.4h14.8M4.6 16.2h7.2" strokeLinecap="round" />
    </svg>
  )
}

function IconThread() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="6" cy="7" r="1.9" />
      <circle cx="18" cy="10.5" r="1.9" />
      <circle cx="9.5" cy="17.5" r="1.9" />
      <path d="m7.6 8.2 8.6 1.6M8.2 16.2l8-4.2M7.1 8.9l1.8 6.7" strokeLinecap="round" />
    </svg>
  )
}
