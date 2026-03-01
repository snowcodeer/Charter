'use client'

import { useState } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
}

export interface StreamItem {
  id: number
  type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'context'
  content: string
  name?: string
  data?: unknown
  done?: boolean
  result?: unknown
  timestamp: number
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  if (!text) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-[#9a8a6e] hover:text-[#c4a455] font-mono flex items-center gap-1"
      >
        <span className={`${open ? 'rotate-90' : ''}`}>▶</span>
        reasoning ({Math.round(text.length / 4)} tokens)
      </button>
      {open && (
        <div className="mt-1 text-xs text-[#6b5a46] font-mono bg-[#1a1410]/80 border border-[#3d2e22] rounded p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  )
}

function getToolDetail(name: string, data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  if (name === 'search_web' && d.query) return `"${d.query}"`
  if (name === 'get_page_contents' && Array.isArray(d.urls) && d.urls[0]) {
    try {
      return new URL(d.urls[0] as string).hostname
    } catch { return null }
  }
  if (name === 'check_calendar') return `${d.startDate} → ${d.endDate}`
  if (name === 'read_emails' && d.query) return `"${d.query}"`
  if (name === 'read_email_body' && d.emailId) return `#${d.emailId}`
  if (name === 'create_calendar_event' && d.title) return `"${d.title}"`
  if (name === 'browser_navigate' && d.url) return `→ ${d.url}`
  if (name === 'browser_fill_fields' && Array.isArray(d.fields)) return `${d.fields.length} fields`
  if (name === 'browser_click' && d.description) return `"${d.description}"`
  if (name === 'browser_scan_page') return 'scanning page...'
  if (name === 'browser_read_page') return 'reading content...'
  if (name === 'browser_execute_js') return 'executing JS...'
  if (name === 'browser_screenshot') return 'taking screenshot...'
  if (name === 'browser_solve_captcha') return 'solving captcha...'
  if (name === 'plan_steps') return 'creating plan...'
  if (name === 'complete_step' && d.stepId) return `step ${d.stepId}`
  if (name === 'propose_actions') return null // rendered as approval cards

  return null
}

function ToolItem({ item }: { item: StreamItem }) {
  if (item.name === 'propose_actions') return null

  const detail = item.name ? getToolDetail(item.name, item.data) : null

  return (
    <div className="text-xs font-mono flex items-center gap-1.5 text-[#9a8a6e] py-0.5">
      {item.done ? (
        <span className="inline-block w-1.5 h-1.5 bg-[#8b9a55] rounded-full flex-shrink-0" />
      ) : (
        <span className="inline-block w-1.5 h-1.5 bg-[#c4a455] rounded-full animate-pulse flex-shrink-0" />
      )}
      <span className={item.done ? 'text-[#6b5a46]' : 'text-[#9a8a6e]'}>
        {item.name}
        {detail && <span className="text-[#6b5a46] ml-1">{detail}</span>}
        {item.done && ' done'}
      </span>
    </div>
  )
}

export function ChatMessages({ messages, streamItems, isLoading, contextGathered }: {
  messages: ChatMessage[]
  streamItems: StreamItem[]
  isLoading: boolean
  contextGathered?: boolean
}) {
  return (
    <div className="flex-1 overflow-y-auto space-y-3 p-4">
      {/* Committed messages */}
      {messages.map((msg, i) => (
        <div key={`msg-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] rounded px-4 py-2 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'bg-[#1a1410]/70 text-[#e8dcc4] border border-[#c4a455]/30'
              : 'bg-[#1a1410]/60 text-[#e8dcc4] border border-[#3d2e22]'
          }`}>
            {msg.role === 'assistant' && msg.thinking && (
              <ThinkingBlock text={msg.thinking} />
            )}
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      ))}

      {/* Context gathered indicator */}
      {contextGathered && streamItems.length === 0 && isLoading && (
        <div className="flex justify-start">
          <div className="text-xs text-[#6b5a46] font-mono flex items-center gap-2 px-2">
            <span className="inline-block w-1.5 h-1.5 bg-[#c4a455] rounded-full" />
            context loaded — passport, calendar, emails
          </div>
        </div>
      )}

      {/* Stream items — rendered sequentially in order */}
      {streamItems.map((item) => {
        if (item.type === 'thinking') {
          return (
            <div key={`si-${item.id}`} className="flex justify-start">
              <div className="max-w-[80%] bg-[#1a1410]/60 border border-[#3d2e22] rounded px-4 py-2">
                <div className="text-xs text-[#9a8a6e] font-mono flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-[#c4a455] rounded-full animate-pulse" />
                  reasoning...
                </div>
              </div>
            </div>
          )
        }

        if (item.type === 'text') {
          return (
            <div key={`si-${item.id}`} className="flex justify-start">
              <div className="max-w-[80%] bg-[#1e1612] border border-[#3d2e22] rounded px-4 py-2 text-sm text-[#e8dcc4] leading-relaxed">
                <p className="whitespace-pre-wrap">{item.content}</p>
              </div>
            </div>
          )
        }

        if (item.type === 'tool_call') {
          return <ToolItem key={`si-${item.id}`} item={item} />
        }

        if (item.type === 'context') {
          return (
            <div key={`si-${item.id}`} className="flex justify-start">
              <div className="text-xs text-[#6b5a46] font-mono flex items-center gap-2 px-2">
                <span className="inline-block w-1.5 h-1.5 bg-[#c4a455] rounded-full" />
                {item.content}
              </div>
            </div>
          )
        }

        return null
      })}

      {/* Loading indicator when nothing has streamed yet */}
      {isLoading && streamItems.length === 0 && !contextGathered && (
        <div className="flex justify-start">
          <div className="bg-[#1a1410]/60 border border-[#3d2e22] rounded px-4 py-2 text-sm text-[#9a8a6e]">
            <span className="inline-block w-1.5 h-1.5 bg-[#9a8a6e] rounded-full animate-pulse mr-2" />
            starting...
          </div>
        </div>
      )}
    </div>
  )
}
