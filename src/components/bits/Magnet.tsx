import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

interface MagnetProps {
  children: ReactNode
  strength?: number
  className?: string
}

/** Pulls its child a few pixels toward the pointer while hovering. */
export default function Magnet({ children, strength = 8, className }: MagnetProps) {
  const host = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 18 })
  const springY = useSpring(y, { stiffness: 260, damping: 18 })

  return (
    <div
      ref={host}
      className={className}
      onPointerMove={(event) => {
        const rect = host.current?.getBoundingClientRect()
        if (!rect) return
        const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width
        const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height
        x.set(dx * strength * 2)
        y.set(dy * strength * 2)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      <motion.div style={{ x: springX, y: springY }}>{children}</motion.div>
    </div>
  )
}
