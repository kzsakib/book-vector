import { motion } from 'motion/react'

interface BlurTextProps {
  text: string
  className?: string
  delay?: number
}

/** Words resolve out of a soft blur, 35 ms apart. */
export default function BlurText({ text, className, delay = 0 }: BlurTextProps) {
  const words = text.split(' ')

  return (
    <span className={className} aria-label={text}>
      {words.map((word, index) => (
        <motion.span
          key={`${text}-${index}`}
          aria-hidden
          initial={{ opacity: 0, filter: 'blur(8px)', y: 6 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{
            duration: 0.42,
            delay: delay + index * 0.035,
            ease: 'easeOut',
          }}
          style={{ display: 'inline-block', marginRight: '0.28em' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}
