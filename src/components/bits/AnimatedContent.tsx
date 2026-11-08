import type { ReactNode } from 'react'
import { motion } from 'motion/react'

interface AnimatedContentProps {
  children: ReactNode
  className?: string
  delay?: number
}

/** Small upward motion, 340 ms, used for panel entrances. */
export default function AnimatedContent({ children, className, delay = 0 }: AnimatedContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
