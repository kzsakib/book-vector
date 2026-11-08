import { useAtlas } from '../store/atlas'

/** Floating stats card, top-left. */
export default function StatsPanel() {
  const count = useAtlas((state) => state.count)
  const clusters = useAtlas((state) => state.clusters)
  const phase = useAtlas((state) => state.phase)
  const metaLoaded = useAtlas((state) => state.metaLoaded)
  const searchIndexed = useAtlas((state) => state.searchIndexed)
  const visibleCount = useAtlas((state) => state.visibleCount)
  const filterActive = useAtlas(
    (state) =>
      state.activeGenres.length > 0 || state.era !== 'all' || state.query.trim().length > 0,
  )

  if (!count) return null

  const metaProgress = count ? Math.min(1, metaLoaded / count) : 0
  const indexProgress = count ? Math.min(1, searchIndexed / count) : 0
  const loading = phase !== 'ready'

  return (
    <section
      aria-label="Dataset statistics"
      className="clay pointer-events-auto absolute left-3 top-[122px] z-20 hidden w-[196px] rounded-[24px] p-4 sm:block sm:left-4 sm:top-[132px]"
    >
      <p className="text-[9px] uppercase tracking-[0.2em] text-soft">On the globe</p>
      <p className="font-serif text-[34px] leading-none text-ink">
        {count.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] text-soft">books · {clusters.length} continents</p>

      <div className="my-3 h-px w-full bg-[#d9dfe8]" />

      <dl className="space-y-1.5 text-[11px]">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-soft">In view</dt>
          <dd className="tabular-nums text-ink">
            {filterActive ? visibleCount.toLocaleString() : 'all'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-soft">Vectors</dt>
          <dd className="tabular-nums text-ink">384-d → 3-d</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-soft">Neighbours</dt>
          <dd className="tabular-nums text-ink">hnsw k=20</dd>
        </div>
      </dl>

      {loading ? (
        <div className="mt-3.5">
          <div className="clay-inset-sm h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-[#b9aef0] transition-[width] duration-300"
              style={{ width: `${Math.max(8, metaProgress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-soft">
            streaming metadata {metaLoaded.toLocaleString()}/{count.toLocaleString()}
          </p>
        </div>
      ) : indexProgress < 1 ? (
        <p className="mt-3.5 text-[10px] text-soft">
          indexing search {Math.round(indexProgress * 100)}%
        </p>
      ) : null}
    </section>
  )
}
