import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'

export interface AnimatedListItem {
  id: number
  content: ReactNode
}

interface AnimatedListProps {
  items: AnimatedListItem[]
  onSelect: (id: number) => void
  onHover?: (id: number | null) => void
  ariaLabel: string
  className?: string
  /** Class applied to every row (e.g. "nearby-row"). */
  rowClassName?: string
  /** Row controlled from outside (e.g. the hovered dot). */
  highlightId?: number | null
}

/** Staggered entry, two-way hover and ArrowUp/ArrowDown/Home/End/Enter selection. */
export default function AnimatedList({
  items,
  onSelect,
  onHover,
  ariaLabel,
  className,
  rowClassName,
  highlightId,
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
      onMouseLeave={() => onHover?.(null)}
      className={className}
    >
      {items.map((item, index) => {
        const highlighted = index === active || item.id === highlightId
        return (
          <motion.div
            key={item.id}
            role="option"
            aria-selected={index === active}
            data-active={index === active}
            data-highlight={item.id === highlightId}
            data-book-row={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.32), ease: 'easeOut' }}
            onMouseEnter={() => {
              setActive(index)
              onHover?.(item.id)
            }}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(item.id)
              }
            }}
            className={`${rowClassName ?? 'cursor-pointer rounded-2xl px-2 py-1.5 transition-colors'}${
              highlighted ? ' is-highlighted' : ''
            }`}
          >
            {item.content}
          </motion.div>
        )
      })}
    </div>
  )
}
