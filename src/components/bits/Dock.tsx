import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export interface DockItem {
  id: string
  label: string
  icon: ReactNode
  active?: boolean
  onClick: () => void
}

interface DockProps {
  items: DockItem[]
  className?: string
}

/** Clay control dock: icons lift on hover, press sinks into the clay. */
export default function Dock({ items, className }: DockProps) {
  return (
    <div className={`stage-dock ${className ?? ''}`} role="toolbar" aria-label="Globe controls">
      {items.map((item) => (
        <motion.button
          key={item.id}
          type="button"
          onClick={item.onClick}
          aria-label={item.label}
          aria-pressed={item.active}
          title={item.label}
          whileHover={{ y: -3, scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          className="dock-btn"
        >
          {item.icon}
        </motion.button>
      ))}
    </div>
  )
}
