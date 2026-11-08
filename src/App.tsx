import { useEffect } from 'react'
import DetailPanel from './components/DetailPanel'
import GlobeStage from './components/GlobeStage'
import Header from './components/Header'
import StatsPanel from './components/StatsPanel'
import Tooltip from './components/Tooltip'
import { useBootstrap } from './hooks/useBootstrap'
import { useAtlas } from './store/atlas'

export default function App() {
  useBootstrap()
  const error = useAtlas((state) => state.error)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useAtlas.getState().select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app-shell">
      <Header />
      <StatsPanel />
      <GlobeStage />
      <DetailPanel />
      <Tooltip />

      {error ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-canvas/70 p-4 backdrop-blur-sm">
          <div className="card max-w-md p-6">
            <p className="eyebrow">Atlas unavailable</p>
            <p className="mt-2 font-serif text-[19px] leading-snug text-ink">
              The dataset could not be loaded.
            </p>
            <p className="mt-1.5 break-words text-[11px] text-soft">{error}</p>
            <p className="mt-3 text-[11px] text-soft">
              Run <code className="rounded bg-white/60 px-1 py-0.5">npm run data:sample</code>, then
              reload.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="clay-sm mt-4 h-9 w-full rounded-full text-[12px] text-ink"
            >
              Reload
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
