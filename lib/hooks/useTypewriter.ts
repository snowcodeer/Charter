'use client'

import { useEffect, useRef, useState } from 'react'

export interface UseTypewriterResult {
  chars: string[]
  isDone: boolean
}

export function useTypewriter(
  text: string,
  revealKey: string | number,
  speedMs: number = 28,
  start: boolean = true
): UseTypewriterResult {
  const [displayLength, setDisplayLength] = useState(0)
  const prevKeyRef = useRef(revealKey)

  useEffect(() => {
    if (prevKeyRef.current !== revealKey) {
      prevKeyRef.current = revealKey
      setDisplayLength(0)
    }
  }, [revealKey])

  useEffect(() => {
    if (!start || displayLength >= text.length) return

    const id = setInterval(() => {
      setDisplayLength((n) => Math.min(n + 1, text.length))
    }, speedMs)
    return () => clearInterval(id)
  }, [text, displayLength, speedMs, start])

  useEffect(() => {
    if (displayLength > text.length) setDisplayLength(text.length)
  }, [text.length, displayLength])

  const chars = text.slice(0, displayLength).split('')
  return { chars, isDone: displayLength >= text.length }
}
