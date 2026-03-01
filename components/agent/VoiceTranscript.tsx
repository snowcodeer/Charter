'use client'

import { useEffect, useRef } from 'react'

interface VoiceTranscriptProps {
  text: string
  maxLines?: number
}

export function VoiceTranscript({ text, maxLines = 6 }: VoiceTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  if (!text) return null

  return (
    <div className="w-full max-w-md mx-auto mt-8">
      <div
        ref={containerRef}
        className="relative bg-[#1a1410]/80 border border-[#4a3728]/50 rounded px-5 py-4 overflow-hidden"
        style={{
          maxHeight: `${maxLines * 1.75}rem`,
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 100%)',
        }}
      >
        <p className="text-sm text-[#f5e6c3] leading-7 font-light tracking-wide whitespace-pre-wrap">
          {text}
        </p>
      </div>
    </div>
  )
}
