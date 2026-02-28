'use client'

import { useEffect, useState } from 'react'

interface AuthStatus {
  google: { connected: boolean; email: string | null }
  exa: { connected: boolean }
  anthropic: { connected: boolean }
  elevenlabs: { connected: boolean }
}

export function ConnectorStatus() {
  const [status, setStatus] = useState<AuthStatus | null>(null)

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
    <div className="flex gap-2 flex-wrap items-center px-4 py-2">
      {connectors.map((c) => (
        c.action ? (
          <a
            key={c.name}
            href={c.action}
            className="text-xs px-3 py-1 rounded-full border border-[#6b4a22] text-[#b08040] bg-[#b08040]/10 hover:bg-[#b08040]/20 transition-colors cursor-pointer"
          >
            + Connect {c.name}
          </a>
        ) : (
          <span
            key={c.name}
            className={`text-xs px-2 py-0.5 rounded-full border ${
              c.connected
                ? 'border-[#6b5a22] text-[#c4a455] bg-[#c4a455]/10'
                : 'border-[#3d2e22] text-[#6b5a46] bg-[#1e1612]'
            }`}
          >
            {c.connected ? '●' : '○'} {c.name}
          </span>
        )
      ))}
    </div>
  )
}
