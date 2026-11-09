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
      <a className="skip-link" href="#atlas-globe">
        Skip to the globe
      </a>
      <Header />
      <StatsPanel />
      <GlobeStage />
      <DetailPanel />
      <Tooltip />

      {error ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-canvas/70 p-4 backdrop-blur-sm">
          <div className="card card-pad max-w-md">
            <p className="eyebrow">Atlas unavailable</p>
            <p className="font-serif mt-2 text-[20px] leading-snug text-ink">
              The dataset could not be loaded.
            </p>
            <p className="muted mt-2 break-words text-[13px]">{error}</p>
            <p className="muted mt-3 text-[12px]">
              Run <code className="rounded bg-white/60 px-1 py-0.5">npm run data:sample</code>, then
              reload.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-raised btn-sm mt-4 w-full"
            >
              Reload
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
