'use client'

import { useEffect, useState } from 'react'

interface AuthStatus {
  google: { connected: boolean; email: string | null }
  exa: { connected: boolean }
  anthropic: { connected: boolean }
  elevenlabs: { connected: boolean }
}

/* Jagged polygon simulating ripped parchment edges (top and bottom) */
const tornClipPath = `polygon(
  0% 3px, 3% 0px, 5% 2px, 8% 0px, 11% 3px, 14% 1px, 17% 3px,
  20% 0px, 23% 2px, 26% 0px, 29% 3px, 32% 1px, 35% 3px,
  38% 0px, 41% 2px, 44% 0px, 47% 3px, 50% 1px, 53% 2px,
  56% 0px, 59% 3px, 62% 1px, 65% 3px, 68% 0px, 71% 2px,
  74% 0px, 77% 3px, 80% 1px, 83% 2px, 86% 0px, 89% 3px,
  92% 1px, 95% 3px, 98% 0px, 100% 2px,
  100% calc(100% - 2px), 97% 100%, 94% calc(100% - 3px), 91% 100%,
  88% calc(100% - 2px), 85% 100%, 82% calc(100% - 3px), 79% 100%,
  76% calc(100% - 2px), 73% 100%, 70% calc(100% - 3px), 67% 100%,
  64% calc(100% - 2px), 61% 100%, 58% calc(100% - 3px), 55% 100%,
  52% calc(100% - 2px), 49% 100%, 46% calc(100% - 3px), 43% 100%,
  40% calc(100% - 2px), 37% 100%, 34% calc(100% - 3px), 31% 100%,
  28% calc(100% - 2px), 25% 100%, 22% calc(100% - 3px), 19% 100%,
  16% calc(100% - 2px), 13% 100%, 10% calc(100% - 3px), 7% 100%,
  4% calc(100% - 2px), 1% 100%, 0% calc(100% - 3px)
)`

export function ConnectorStatus({ variant = 'parchment' }: { variant?: 'parchment' | 'dark' }) {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const dark = variant === 'dark'

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  const connectors = [
    { name: 'Exa Search', connected: status?.exa.connected ?? false },
    { name: 'Claude', connected: status?.anthropic.connected ?? false },
    {
      name: status?.google.connected ? `Google (${status.google.email})` : 'Google',
      connected: status?.google.connected ?? false,
      action: !status?.google.connected ? '/api/auth/google' : undefined,
    },
    { name: 'ElevenLabs', connected: status?.elevenlabs.connected ?? false },
  ]

  return (
    <div
      className={dark
        ? 'flex gap-2 flex-wrap items-center px-3 py-1.5 rounded-lg border border-[#4a3728] bg-[#2a1f18]/60'
        : 'flex gap-2 flex-wrap items-center px-5 py-2.5'
      }
      style={dark ? undefined : {
        background: 'linear-gradient(180deg, #e8cdb0 0%, #dfc09a 50%, #d4b896 100%)',
        clipPath: tornClipPath,
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.25)',
      }}
    >
      {connectors.map((c) => (
        c.action ? (
          <a
            key={c.name}
            href={c.action}
            className={dark
              ? 'text-xs px-3 py-1 rounded-full border border-[#6b5344] text-[#d4b896] hover:text-[#e8cdb5] hover:border-[#8b7355] transition-colors cursor-pointer'
              : 'text-xs px-3 py-1 rounded-full border border-[#8b7355]/50 text-[#6b5344] bg-[#1a1410]/10 hover:bg-[#1a1410]/20 transition-colors cursor-pointer'
            }
          >
            + Connect {c.name}
          </a>
        ) : (
          <span
            key={c.name}
            className={`text-xs px-2 py-0.5 rounded-full border ${
              dark
                ? c.connected
                  ? 'border-[#6b5344]/60 text-[#d4b896]'
                  : 'border-[#4a3728]/60 text-[#8b7355]'
                : c.connected
                  ? 'border-[#8b7355]/40 text-[#4a3728] bg-[#1a1410]/10'
                  : 'border-[#8b7355]/30 text-[#8b7355] bg-[#1a1410]/5'
            }`}
          >
            {c.connected ? '●' : '○'} {c.name}
          </span>
        )
      ))}
    </div>
  )
}
