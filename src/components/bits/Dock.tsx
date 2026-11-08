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

/** Clay control dock: icons lift and scale on hover, press sinks into the clay. */
export default function Dock({ items, className }: DockProps) {
  return (
    <div
      className={`flex items-end gap-1.5 rounded-full px-2 py-2 ${className ?? ''}`}
      role="toolbar"
      aria-label="Globe controls"
    >
      {items.map((item) => (
        <div key={item.id} className="group relative">
          <motion.button
            type="button"
            onClick={item.onClick}
            aria-label={item.label}
            aria-pressed={item.active}
            title={item.label}
            whileHover={{ scale: 1.14, y: -3 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className={`grid h-9 w-9 place-items-center rounded-full text-ink transition-colors ${
              item.active === false ? 'opacity-45' : 'opacity-100'
            } ${item.active ? 'clay-inset' : 'clay-sm hover:text-[#4a3fa8]'}`}
          >
            {item.icon}
          </motion.button>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-canvas px-2 py-1 text-[10px] text-soft shadow-[var(--shadow-raised)] group-hover:block"
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
