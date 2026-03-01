'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActionHistoryItem } from '@/components/agent/executionTypes'

interface ReasoningDrawerProps {
  open: boolean
  text: string
  isLoading: boolean
  actionHistory: ActionHistoryItem[]
  onClose: () => void
}

function toolLabel(name: string): string {
  const map: Record<string, string> = {
    search_web: 'Web research',
    get_page_contents: 'Read source page',
    get_passport_profile: 'Loaded passport profile',
    update_passport_profile: 'Updated passport profile',
    check_calendar: 'Checked calendar',
    create_calendar_event: 'Created calendar event',
    read_emails: 'Searched email',
    read_email_body: 'Read full email',
    search_drive_files: 'Searched drive files',
    scan_passport_photo: 'Scanned passport image',
    plan_steps: 'Created execution plan',
    add_plan_step: 'Added plan step',
    complete_step: 'Completed plan step',
    browser_navigate: 'Opened website',
    browser_scan_page: 'Scanned web form',
    browser_fill_fields: 'Filled form fields',
    browser_click: 'Clicked button',
    browser_read_page: 'Read page content',
    browser_screenshot: 'Captured screenshot',
    browser_execute_js: 'Executed page script',
    browser_solve_captcha: 'Solved captcha',
    show_on_globe: 'Updated globe view',
  }
  return map[name] || name.replaceAll('_', ' ')
}

function actionSummary(item: ActionHistoryItem): string {
  const data = item.data as Record<string, unknown> | null
  if (!data || typeof data !== 'object') {
    return item.type === 'tool_start' ? 'Started' : item.type === 'tool_result' ? 'Finished' : 'Prepared'
  }

  if (item.name === 'browser_navigate') {
    const url = typeof data.url === 'string' ? data.url : ''
    return url ? `Navigating to ${url}` : 'Navigating to target page'
  }

  if (item.name === 'browser_fill_fields') {
    const fields = Array.isArray(data.fields) ? data.fields.length : Array.isArray((data.result as Record<string, unknown>)?.results) ? ((data.result as Record<string, unknown>).results as unknown[]).length : 0
    return fields > 0 ? `${fields} fields processed` : 'Processing form fields'
  }

  if (item.name === 'browser_click') {
    const description = typeof data.description === 'string' ? data.description : typeof data.text === 'string' ? data.text : ''
    return description ? `Action: ${description}` : 'Click action'
  }

  if (item.name === 'browser_scan_page') {
    const fields = Array.isArray(data.fields) ? data.fields.length : 0
    const buttons = Array.isArray(data.buttons) ? data.buttons.length : 0
    return fields || buttons ? `Found ${fields} fields and ${buttons} buttons` : 'Scanning page structure'
  }

  if (item.name === 'search_web') {
    const query = typeof data.query === 'string' ? data.query : ''
    return query ? `Query: ${query}` : 'Searching web sources'
  }

  return item.type === 'tool_start' ? 'Started' : item.type === 'tool_result' ? 'Finished' : 'Prepared'
}

function shortJson(data: unknown): string {
  try {
    const text = JSON.stringify(data, null, 2)
    if (!text) return ''
    return text.length > 1400 ? `${text.slice(0, 1400)}\n...` : text
  } catch {
    return String(data ?? '')
  }
}

export function ReasoningDrawer({ open, text, isLoading, actionHistory, onClose }: ReasoningDrawerProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'reasoning' | 'verification'>('reasoning')
  const verificationItems = useMemo(() => actionHistory.slice(-120), [actionHistory])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !bodyRef.current || tab !== 'reasoning') return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [open, text, tab])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close reasoning drawer" />
      <aside className="absolute top-0 right-0 h-full w-full max-w-[480px] border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-sm flex flex-col animate-[slide-up_220ms_ease-out]">
        <div className="h-14 px-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('reasoning')}
              className={`text-xs px-2 py-1 rounded ${tab === 'reasoning' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Reasoning
            </button>
            <button
              type="button"
              onClick={() => setTab('verification')}
              className={`text-xs px-2 py-1 rounded ${tab === 'verification' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Verification
            </button>
            <span className={`text-[10px] ${isLoading ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {isLoading ? 'live' : 'idle'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500">
              {tab === 'reasoning' ? `~${Math.round(text.length / 4)} tokens` : `${verificationItems.length} events`}
            </span>
            <button type="button" onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-200">
              Close
            </button>
          </div>
        </div>
        {tab === 'reasoning' ? (
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-4">
            <pre className="text-xs leading-relaxed text-zinc-500 font-mono whitespace-pre-wrap">
              {text || (isLoading ? 'Waiting for reasoning updates...' : 'No active reasoning.')}
            </pre>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {verificationItems.length === 0 ? (
              <p className="text-xs text-zinc-500 px-1">No verification events yet.</p>
            ) : (
              verificationItems.map((item) => (
                <details key={item.id} className="rounded-md border border-zinc-800/80 bg-zinc-950/30 px-2.5 py-2">
                  <summary className="cursor-pointer text-xs text-zinc-300">
                    <span className="text-zinc-500 mr-2">{new Date(item.ts).toLocaleTimeString()}</span>
                    <span className="mr-2 text-zinc-400">{toolLabel(item.name)}</span>
                    <span className="text-zinc-500">- {actionSummary(item)}</span>
                  </summary>
                  <pre className="mt-2 text-[11px] leading-relaxed text-zinc-500 font-mono whitespace-pre-wrap">
                    {shortJson(item.data)}
                  </pre>
                </details>
              ))
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
