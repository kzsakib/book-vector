import { Suspense, lazy, useEffect } from 'react'
import Backdrop from './components/Backdrop'
import DetailPanel from './components/DetailPanel'
import GenreLegend from './components/GenreLegend'
import Header from './components/Header'
import StatsPanel from './components/StatsPanel'
import Tooltip from './components/Tooltip'
import { useBootstrap } from './hooks/useBootstrap'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useAtlas } from './store/atlas'

const GlobeScene = lazy(() => import('./components/GlobeScene'))

export default function App() {
  useBootstrap()
  const reduced = useReducedMotion()
  const phase = useAtlas((state) => state.phase)
  const error = useAtlas((state) => state.error)
  const count = useAtlas((state) => state.count)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useAtlas.getState().select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-canvas">
      <Backdrop />
      <Suspense fallback={null}>
        <GlobeScene />
      </Suspense>

      <Header />
      <StatsPanel />
      <GenreLegend />
      <DetailPanel />
      <Tooltip />

      <p className="pointer-events-none absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-soft/85 lg:block">
        drag to rotate · scroll to zoom · double-click a continent
      </p>

      {phase !== 'ready' && !error ? (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
          aria-live="polite"
        >
          <div className="clay flex items-center gap-2.5 rounded-full px-4 py-2 text-[11px] text-soft">
            <span
              className={`h-2 w-2 rounded-full bg-[#b9aef0] ${reduced ? '' : 'animate-pulse'}`}
              aria-hidden
            />
            {count ? 'Streaming books onto the globe…' : 'Unrolling the atlas…'}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-x-4 bottom-4 z-40 mx-auto max-w-md sm:bottom-6">
          <div className="clay rounded-[26px] p-5">
            <p className="text-[9px] uppercase tracking-[0.2em] text-soft">Atlas unavailable</p>
            <p className="mt-2 font-serif text-[18px] leading-snug text-ink">
              The dataset could not be loaded.
            </p>
            <p className="mt-1.5 break-words text-[11px] text-soft">{error}</p>
            <p className="mt-3 text-[11px] text-soft">
              Run <code className="rounded bg-white/60 px-1 py-0.5">npm run data:sample</code> to
              rebuild the bundled sample, then reload.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="clay-sm mt-4 h-9 w-full rounded-full text-[12px] text-ink hover:text-[#4a3fa8]"
            >
              Reload
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
