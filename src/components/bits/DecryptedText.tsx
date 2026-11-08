import { useEffect, useState } from 'react'

interface DecryptedTextProps {
  text: string
  className?: string
  speed?: number
}

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'

/** Scrambles, then resolves left to right. Restarts whenever the text changes. */
export default function DecryptedText({ text, className, speed = 28 }: DecryptedTextProps) {
  const [output, setOutput] = useState(text)

  useEffect(() => {
    let step = 0
    const id = window.setInterval(() => {
      step += 1
      const revealed = Math.floor(step / 2)
      setOutput(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ' || index < revealed) return char
            return GLYPHS[(index * 7 + step * 13) % GLYPHS.length]
          })
          .join(''),
      )
      if (revealed >= text.length) window.clearInterval(id)
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed])

  return (
    <span className={className} aria-label={text}>
      {output}
    </span>
  )
}
