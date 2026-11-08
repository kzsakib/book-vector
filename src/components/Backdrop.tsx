/** Pale rings and the big blurred clay shadow behind the globe. */
export default function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative aspect-square w-[min(94vmin,780px)]">
          <div className="absolute inset-[2%] rounded-full border border-white/55" />
          <div className="absolute inset-[-4%] rounded-full border border-[#d3dae5]/55" />
          <div className="absolute inset-[7%] rounded-full border border-white/40" />
          <div className="absolute inset-[14%] rounded-full border border-[#dfe4ec]/50" />
          <div
            className="absolute left-1/2 top-[62%] h-[16%] w-[58%] -translate-x-1/2 rounded-[50%]"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(120,133,155,0.42) 0%, rgba(120,133,155,0.16) 45%, transparent 72%)',
              filter: 'blur(26px)',
            }}
          />
        </div>
      </div>
      <div className="grain absolute inset-0" />
    </div>
  )
}
