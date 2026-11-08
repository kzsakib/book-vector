import { motion } from 'motion/react'

export interface GooeyNavItem<T extends string> {
  id: T
  label: string
}

interface GooeyNavProps<T extends string> {
  items: GooeyNavItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

/** A soft blob slides between segments; the active segment is inset into clay. */
export default function GooeyNav<T extends string>({
  items,
  value,
  onChange,
  label,
}: GooeyNavProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-2xl p-1"
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`relative flex-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-[10.5px] transition-colors ${
              active ? 'text-ink' : 'text-soft hover:text-ink'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="decade-blob"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="clay-inset absolute inset-0 rounded-xl"
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
