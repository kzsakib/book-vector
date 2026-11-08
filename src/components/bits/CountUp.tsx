import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  value: number
  duration?: number
  className?: string
}

/** Counts to a new value with an ease-out curve, on the compositor-free path. */
export default function CountUp({ value, duration = 800, className }: CountUpProps) {
  const [display, setDisplay] = useState(value)
  const previous = useRef(value)

  useEffect(() => {
    const from = previous.current
    if (from === value) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
      else previous.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      previous.current = value
    }
  }, [value, duration])

  return (
    <span className={className}>
      {display.toLocaleString('en-US')}
    </span>
  )
}
