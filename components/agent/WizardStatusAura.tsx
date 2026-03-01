'use client'

import { useEffect, useRef, useState } from 'react'
import type { ConsultationState } from '@/lib/hooks/useConsultationState'

export interface WizardStatusAuraProps {
  state: ConsultationState
}

export function WizardStatusAura({ state }: WizardStatusAuraProps) {
  const [showDoneFade, setShowDoneFade] = useState(false)
  const prevStateRef = useRef<ConsultationState>('idle')

  useEffect(() => {
    const prev = prevStateRef.current
    prevStateRef.current = state

    if (prev === 'processing' && state !== 'processing') {
      setShowDoneFade(true)
      const t = setTimeout(() => setShowDoneFade(false), 800)
      return () => clearTimeout(t)
    }
  }, [state])

  const active = state === 'processing'
  const visible = active || showDoneFade

  return (
    <div
      className="fixed left-1/2 flex items-center gap-2 transition-opacity duration-[800ms] z-20"
      style={{
        bottom: '108px',
        transform: 'translateX(-50%)',
        opacity: visible ? 1 : 0,
      }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] h-[3px] rounded-full"
          style={{
            background: 'rgba(201, 160, 80, 0.6)',
            animation: active ? `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite` : 'none',
          }}
        />
      ))}
    </div>
  )
}
