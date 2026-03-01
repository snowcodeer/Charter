'use client'

import { useState } from 'react'
import type { ConsultationState } from '@/lib/hooks/useConsultationState'

export interface ConsultationInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (text: string) => void
  onMicClick: () => void
  onPassportClick: () => void
  isListening: boolean
  voiceMode: boolean
  passportMissing: boolean
  consultationState: ConsultationState
  disabled?: boolean
  variant?: 'parchment' | 'dark'
}

/* Jagged polygon simulating ripped paper edges (top and bottom) */
const tornClipPath = `polygon(
  0% 4px, 2% 0px, 4% 3px, 7% 1px, 10% 4px, 13% 0px, 16% 3px,
  19% 1px, 22% 4px, 25% 0px, 28% 3px, 31% 1px, 34% 4px, 37% 0px,
  40% 2px, 43% 0px, 46% 3px, 49% 1px, 52% 4px, 55% 0px, 58% 3px,
  61% 1px, 64% 4px, 67% 0px, 70% 2px, 73% 0px, 76% 3px, 79% 1px,
  82% 4px, 85% 0px, 88% 3px, 91% 1px, 94% 4px, 97% 0px, 100% 3px,
  100% calc(100% - 3px), 98% 100%, 95% calc(100% - 3px), 92% 100%,
  89% calc(100% - 2px), 86% 100%, 83% calc(100% - 3px), 80% 100%,
  77% calc(100% - 4px), 74% 100%, 71% calc(100% - 2px), 68% 100%,
  65% calc(100% - 3px), 62% 100%, 59% calc(100% - 4px), 56% 100%,
  53% calc(100% - 2px), 50% 100%, 47% calc(100% - 3px), 44% 100%,
  41% calc(100% - 4px), 38% 100%, 35% calc(100% - 2px), 32% 100%,
  29% calc(100% - 3px), 26% 100%, 23% calc(100% - 4px), 20% 100%,
  17% calc(100% - 2px), 14% 100%, 11% calc(100% - 3px), 8% 100%,
  5% calc(100% - 4px), 2% 100%, 0% calc(100% - 2px)
)`

export function ConsultationInput({
  value,
  onChange,
  onSubmit,
  onMicClick,
  onPassportClick,
  isListening,
  voiceMode,
  passportMissing,
  consultationState,
  disabled = false,
  variant = 'parchment',
}: ConsultationInputProps) {
  const [focused, setFocused] = useState(false)
  const dark = variant === 'dark'

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed) onSubmit(trimmed)
    }
  }

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-[680px] px-4 z-20"
      style={{ bottom: '24px' }}
      data-consultation-state={consultationState}
    >
      {dark ? (
        <div
          className={`consultation-input relative flex items-center rounded-xl border border-[#4a3728] bg-[#2a1f18]/80 backdrop-blur-sm transition-shadow duration-500 ${
            focused ? 'shadow-lg shadow-black/20 border-[#6b5344]' : ''
          }`}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Speak your intent..."
            disabled={disabled}
            className="w-full bg-transparent py-3 pl-11 pr-10 text-sm text-[#faf5f0] outline-none placeholder:italic placeholder:text-[#6b5344]"
            aria-label="Ask the Vizard"
          />
          <button
            type="button"
            onClick={onPassportClick}
            className="absolute left-3 p-1 focus:outline-none rounded-[2px] transition-colors"
            style={{
              color: '#d4b896',
              opacity: passportMissing ? 0.85 : 0.5,
              animation: passportMissing ? 'passport-nudge 2.2s ease-in-out infinite' : undefined,
            }}
            title="Open passport profile"
            aria-label="Open passport profile"
          >
            <PassportSigil />
          </button>
          {voiceMode && (
            <button
              type="button"
              onClick={onMicClick}
              className="absolute right-3 p-1 focus:outline-none"
              style={{
                color: '#d4b896',
                opacity: isListening ? undefined : 0.4,
                animation: isListening ? 'mic-breathe 2.4s ease-in-out infinite' : undefined,
              }}
              title={isListening ? 'Stop listening' : 'Start listening'}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              <MicIcon />
            </button>
          )}
        </div>
      ) : (
        <div
          className="consultation-input relative flex items-center transition-shadow duration-500"
          style={{
            background: focused
              ? 'linear-gradient(180deg, #f0ddc0 0%, #e8cdb0 50%, #dfc09a 100%)'
              : 'linear-gradient(180deg, #e8cdb0 0%, #dfc09a 50%, #d4b896 100%)',
            clipPath: tornClipPath,
            boxShadow: focused
              ? '0 2px 20px rgba(201, 160, 80, 0.25)'
              : '0 1px 8px rgba(0, 0, 0, 0.3)',
            padding: '4px 0',
          }}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Speak your intent..."
            disabled={disabled}
            className="w-full bg-transparent py-3 pl-11 pr-10 text-sm outline-none placeholder:italic"
            style={{
              color: '#2a1f18',
              fontFamily: 'var(--font-ui), sans-serif',
            }}
            aria-label="Ask the Vizard"
          />
          <button
            type="button"
            onClick={onPassportClick}
            className="absolute left-3 p-1 focus:outline-none rounded-[2px] transition-colors"
            style={{
              color: '#6b5344',
              opacity: passportMissing ? 0.85 : 0.5,
              animation: passportMissing ? 'passport-nudge 2.2s ease-in-out infinite' : undefined,
            }}
            title="Open passport profile"
            aria-label="Open passport profile"
          >
            <PassportSigil />
          </button>
          {voiceMode && (
            <button
              type="button"
              onClick={onMicClick}
              className="absolute right-3 p-1 focus:outline-none"
              style={{
                color: '#6b5344',
                opacity: isListening ? undefined : 0.4,
                animation: isListening ? 'mic-breathe 2.4s ease-in-out infinite' : undefined,
              }}
              title={isListening ? 'Stop listening' : 'Start listening'}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              <MicIcon />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PassportSigil() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="11" r="3" />
      <path d="M8 18c1.2-1.5 2.4-2.2 4-2.2s2.8.7 4 2.2" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}
