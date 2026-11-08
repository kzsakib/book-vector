import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'

export interface AnimatedListItem {
  id: number
  content: ReactNode
}

interface AnimatedListProps {
  items: AnimatedListItem[]
  onSelect: (id: number) => void
  ariaLabel: string
  className?: string
}

/** Staggered entry plus ArrowUp/ArrowDown/Home/End/Enter keyboard selection. */
export default function AnimatedList({
  items,
  onSelect,
  ariaLabel,
  className,
}: AnimatedListProps) {
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!items.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (index + delta + items.length) % items.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(items.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(items[Math.min(active, items.length - 1)].id)
    }
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={() => {
        const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
        node?.scrollIntoView({ block: 'nearest' })
      }}
      className={className}
    >
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          role="option"
          aria-selected={index === active}
          data-active={index === active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.32), ease: 'easeOut' }}
          onMouseEnter={() => setActive(index)}
          onClick={() => onSelect(item.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(item.id)
            }
          }}
          className={`cursor-pointer rounded-2xl px-2 py-1.5 transition-colors ${
            index === active ? 'clay-inset' : 'hover:bg-white/40'
          }`}
        >
          {item.content}
        </motion.div>
      ))}
    </div>
  )
}
