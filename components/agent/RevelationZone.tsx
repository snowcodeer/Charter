'use client'

import { useEffect, useRef, useState } from 'react'
import { useTypewriter } from '@/lib/hooks/useTypewriter'

const EXIT_DURATION_MS = 500

export interface RevelationZoneProps {
  text: string
  revealKey: string | number
  error?: boolean
}

export function RevelationZone({ text, revealKey, error = false }: RevelationZoneProps) {
  const [exitingText, setExitingText] = useState<string | null>(null)
  const [startReveal, setStartReveal] = useState(true)
  const prevKeyRef = useRef(revealKey)
  const prevTextRef = useRef(text)

  useEffect(() => {
    if (prevKeyRef.current === revealKey) {
      prevTextRef.current = text
      return
    }

    prevKeyRef.current = revealKey
    if (prevTextRef.current.trim()) {
      setExitingText(prevTextRef.current)
      setStartReveal(false)
    }
    prevTextRef.current = text
  }, [revealKey, text])

  useEffect(() => {
    if (!exitingText) return
    const t = setTimeout(() => {
      setExitingText(null)
      setStartReveal(true)
    }, EXIT_DURATION_MS)
    return () => clearTimeout(t)
  }, [exitingText])

  const { chars } = useTypewriter(text, revealKey, 28, startReveal)
  const showError = error && !exitingText && chars.length === 0
  const hasContent = Boolean(exitingText) || chars.length > 0 || showError
  if (!hasContent) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-[600px] min-h-[80px] px-4 flex items-center justify-center z-20"
      style={{ bottom: '120px' }}
      aria-live="polite"
    >
      {exitingText ? (
        <p
          className="revelation-text w-full text-center whitespace-pre-wrap"
          style={{ animation: `revelation-exit ${EXIT_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards` }}
        >
          {exitingText}
        </p>
      ) : showError ? (
        <p className="revelation-text revelation-error w-full text-center">
          The vision falters. Speak again.
        </p>
      ) : (
        <p className="revelation-text w-full text-center whitespace-pre-wrap">
          {chars.map((char, i) => (
            <span
              key={`${revealKey}-${i}`}
              className="revelation-char"
              style={{ animation: 'char-arrive 120ms ease-out forwards' }}
            >
              {char}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
