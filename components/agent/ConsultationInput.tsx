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
}

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
}: ConsultationInputProps) {
  const [focused, setFocused] = useState(false)

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
      <div
        className="consultation-input relative flex items-center rounded-[2px] transition-[border-color] duration-[600ms] ease-out"
        style={{
          background: 'rgba(8, 6, 4, 0.45)',
          backdropFilter: 'blur(16px) saturate(140%)',
          border: `1px solid ${focused ? 'rgba(201, 160, 80, 0.55)' : 'rgba(201, 160, 80, 0.2)'}`,
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
            color: 'rgba(245, 230, 195, 0.95)',
            fontFamily: 'var(--font-ui), sans-serif',
          }}
          aria-label="Ask the Vizard"
        />

        <button
          type="button"
          onClick={onPassportClick}
          className="absolute left-3 p-1 text-amber-200/80 hover:text-amber-200 focus:outline-none rounded-[2px] transition-colors"
          style={{
            opacity: passportMissing ? 0.85 : 0.35,
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
            className="absolute right-3 p-1 text-amber-200/80 hover:text-amber-200 focus:outline-none"
            style={{
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
