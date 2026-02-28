'use client'

import { useState } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
}

export interface ToolEvent {
  type: 'tool_call' | 'tool_result' | 'tool_start'
  name: string
  data: unknown
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  if (!text) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-zinc-500 hover:text-zinc-400 font-mono flex items-center gap-1 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        reasoning ({Math.round(text.length / 4)} tokens)
      </button>
      {open && (
        <div className="mt-1 text-xs text-zinc-600 font-mono bg-zinc-950 border border-zinc-900 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  )
}

function getToolDetail(event: ToolEvent): string | null {
  if (!event.data || typeof event.data !== 'object') return null
  const d = event.data as Record<string, unknown>

  if (event.type === 'tool_call') {
    // Show the search query for search_web
    if (event.name === 'search_web' && d.query) return `"${d.query}"`
    if (event.name === 'get_page_contents' && Array.isArray(d.urls) && d.urls[0]) {
      try {
        return new URL(d.urls[0] as string).hostname
      } catch { return null }
    }
    if (event.name === 'check_calendar') return `${d.startDate} → ${d.endDate}`
    if (event.name === 'read_emails' && d.query) return `"${d.query}"`
    if (event.name === 'create_calendar_event' && d.title) return `"${d.title}"`
  }

  // Browser tools
  if (event.name === 'browser_navigate' && d.url) return `→ ${d.url}`
  if (event.name === 'browser_fill_fields' && Array.isArray(d.fields)) return `${d.fields.length} fields`
  if (event.name === 'browser_click' && d.description) return `"${d.description}"`
  if (event.name === 'browser_scan_page') return 'scanning page...'
  if (event.name === 'browser_read_page') return 'reading content...'

  return null
}

export function ChatMessages({ messages, toolEvents, isLoading, streamingThinking, contextGathered }: {
  messages: ChatMessage[]
  toolEvents: ToolEvent[]
  isLoading: boolean
  streamingThinking?: string
  contextGathered?: boolean
}) {
  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'bg-white text-black'
              : 'bg-zinc-900 text-zinc-100 border border-zinc-800'
          }`}>
            {msg.role === 'assistant' && msg.thinking && (
              <ThinkingBlock text={msg.thinking} />
            )}
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      ))}

      {/* Context gathered indicator */}
      {contextGathered && toolEvents.length === 0 && !streamingThinking && isLoading && (
        <div className="flex justify-start">
          <div className="text-xs text-zinc-600 font-mono flex items-center gap-2 px-2">
            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            context loaded — passport, calendar, emails
          </div>
        </div>
      )}

      {/* Streaming thinking indicator */}
      {streamingThinking && (
        <div className="flex justify-start">
          <div className="max-w-[80%] bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2">
            <div className="text-xs text-zinc-500 font-mono flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              reasoning...
            </div>
          </div>
        </div>
      )}

      {/* Tool events */}
      {toolEvents.length > 0 && (
        <div className="flex justify-start">
          <div className="max-w-[85%] space-y-1">
            {toolEvents.map((evt, i) => {
              const detail = getToolDetail(evt)
              const isDone = evt.type === 'tool_result'
              const isActive = evt.type === 'tool_call' || evt.type === 'tool_start'

              // Skip propose_actions from tool display (handled as approval cards)
              if (evt.name === 'propose_actions') return null

              return (
                <div key={i} className="text-xs font-mono flex items-center gap-1.5 text-zinc-500">
                  {isActive ? (
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
                  ) : (
                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                  )}
                  <span className={isDone ? 'text-zinc-600' : 'text-zinc-400'}>
                    {evt.name}
                    {detail && <span className="text-zinc-600 ml-1">{detail}</span>}
                    {isDone && ' done'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isLoading && !streamingThinking && toolEvents.length === 0 && !contextGathered && (
        <div className="flex justify-start">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 text-sm text-zinc-400">
            <span className="inline-block w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse mr-2" />
            starting...
          </div>
        </div>
      )}
    </div>
  )
}
