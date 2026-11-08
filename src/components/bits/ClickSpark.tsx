import { useEffect, useRef, type ReactNode } from 'react'

const SPARK_COLORS = ['#B9AEF0', '#A9CDF0', '#F2B6CC', '#F5CFA0', '#A8DCC3', '#E3A6A6']

interface ClickSparkProps {
  children: ReactNode
  className?: string
}

/**
 * Canvas spark burst wherever the user presses. The canvas never receives
 * pointer events, so picking and orbit dragging are untouched.
 */
export default function ClickSpark({ children, className }: ClickSparkProps) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = host.current
    const surface = canvas.current
    const context = surface?.getContext('2d')
    if (!element || !surface || !context) return

    interface Spark {
      x: number
      y: number
      vx: number
      vy: number
      life: number
      color: string
    }

    let sparks: Spark[] = []
    let frame = 0
    let width = 0
    let height = 0

    const resize = () => {
      const rect = element.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      width = rect.width
      height = rect.height
      surface.width = Math.round(width * dpr)
      surface.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const tick = () => {
      context.clearRect(0, 0, width, height)
      sparks = sparks.filter((spark) => spark.life > 0)
      for (const spark of sparks) {
        spark.x += spark.vx
        spark.y += spark.vy
        spark.vy += 0.03
        spark.vx *= 0.99
        spark.life -= 0.02
        context.globalAlpha = Math.max(0, spark.life)
        context.fillStyle = spark.color
        context.beginPath()
        context.arc(spark.x, spark.y, 2.6 * spark.life + 0.5, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
      frame = sparks.length ? requestAnimationFrame(tick) : 0
    }

    const onPointerDown = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4
        const speed = 1.1 + Math.random() * 1.7
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: SPARK_COLORS[i % SPARK_COLORS.length],
        })
      }
      if (!frame) frame = requestAnimationFrame(tick)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    element.addEventListener('pointerdown', onPointerDown)

    return () => {
      observer.disconnect()
      element.removeEventListener('pointerdown', onPointerDown)
      if (frame) cancelAnimationFrame(frame)
      context.clearRect(0, 0, width, height)
    }
  }, [])

  return (
    <div ref={host} className={`relative ${className ?? ''}`}>
      {children}
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
    </div>
  )
}
