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
            className="text-xs px-3 py-1 rounded-full border border-blue-800 text-blue-400 bg-blue-950/30 hover:bg-blue-900/40 transition-colors cursor-pointer"
          >
            + Connect {c.name}
          </a>
        ) : (
          <span
            key={c.name}
            className={`text-xs px-2 py-0.5 rounded-full border ${
              c.connected
                ? 'border-green-800 text-green-400 bg-green-950/30'
                : 'border-zinc-800 text-zinc-600 bg-zinc-950/30'
            }`}
          >
            {c.connected ? '●' : '○'} {c.name}
          </span>
        )
      ))}
    </div>
  )
}
