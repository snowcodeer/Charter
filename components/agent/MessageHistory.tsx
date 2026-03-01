'use client'

import type { ChatMessage } from '@/components/agent/ChatMessages'
import { formatAgentOutput } from '@/components/agent/formatAgentOutput'

interface MessageHistoryProps {
  messages: ChatMessage[]
}

function roleLabel(role: ChatMessage['role']): string {
  return role === 'user' ? 'You' : 'Agent'
}

export function MessageHistory({ messages }: MessageHistoryProps) {
  if (messages.length === 0) return null

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-3 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">Message history</p>

      <div className="space-y-2">
        {messages.map((message, index) => {
          const formatted = formatAgentOutput(message.content)
          if (!formatted && !message.thinking) return null
          return (
            <article key={`${message.role}-${index}`} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  message.role === 'user'
                    ? 'border-zinc-700 text-zinc-300 bg-zinc-900/60'
                    : 'border-purple-800/70 text-purple-300 bg-purple-950/20'
                }`}>
                  {roleLabel(message.role)}
                </span>
              </div>

              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{formatted}</p>

              {message.role === 'assistant' && message.thinking && (
                <details className="mt-2 border-t border-zinc-800 pt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                    Reasoning archive
                  </summary>
                  <pre className="mt-2 text-xs text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed">
                    {message.thinking}
                  </pre>
                </details>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
