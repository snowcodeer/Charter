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
    <section className="rounded border border-[#4a3728] bg-[#2a1f18]/35 p-3 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-[#b8956f]">Message history</p>

      <div className="space-y-2">
        {messages.map((message, index) => {
          const formatted = formatAgentOutput(message.content)
          if (!formatted && !message.thinking) return null
          return (
            <article key={`${message.role}-${index}`} className="rounded border border-[#4a3728]/80 bg-[#1a1410]/40 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${
                  message.role === 'user'
                    ? 'border-[#6b5344] text-[#e8cdb5] bg-[#2a1f18]/60'
                    : 'border-[#8b6f47]/70 text-[#8b6f47] bg-[#8b6f47]/20'
                }`}>
                  {roleLabel(message.role)}
                </span>
              </div>

              <p className="text-sm text-[#f5e6c3] leading-relaxed whitespace-pre-wrap">{formatted}</p>

              {message.role === 'assistant' && message.thinking && (
                <details className="mt-2 border-t border-[#4a3728] pt-2">
                  <summary className="cursor-pointer text-xs text-[#b8956f] hover:text-[#e8cdb5]">
                    Reasoning archive
                  </summary>
                  <pre className="mt-2 text-xs text-[#b8956f] font-mono whitespace-pre-wrap leading-relaxed">
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
