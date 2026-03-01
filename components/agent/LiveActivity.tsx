'use client'

import { FormFillCard } from '@/components/agent/FormFillCard'
import { formatAgentOutput } from '@/components/agent/formatAgentOutput'
import type { LiveActivityState, ScanSummary } from '@/components/agent/executionTypes'

interface LiveActivityProps {
  liveActivity: LiveActivityState | null
  lastScan: ScanSummary | null
  streamingText: string
  isLoading: boolean
}

function toDetail(name: string, data?: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (name === 'browser_navigate' && typeof d.url === 'string') return d.url
  if (name === 'browser_click' && typeof d.description === 'string') return d.description
  return null
}

export function LiveActivity({ liveActivity, lastScan, streamingText, isLoading }: LiveActivityProps) {
  if (liveActivity?.type === 'fill') {
    return <FormFillCard fields={liveActivity.fields} />
  }

  if (liveActivity?.type === 'tool') {
    const detail = toDetail(liveActivity.name, liveActivity.data)
    return (
      <div className="rounded-xl border border-[#4a3728] bg-[#2a1f18]/60 backdrop-blur-sm p-4 animate-[slide-up_240ms_ease-out]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[#f5e6c3] font-medium">{liveActivity.name}</p>
          {liveActivity.status === 'active' && (
            <span className="h-4 w-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          )}
          {liveActivity.status === 'done' && <span className="text-emerald-400 text-xs">done</span>}
          {liveActivity.status === 'error' && <span className="text-red-400 text-xs">error</span>}
        </div>
        {detail && <p className="mt-2 text-xs text-[#d4b896] truncate">→ {detail}</p>}
        {liveActivity.name === 'browser_scan_page' && lastScan && (
          <p className="mt-2 text-xs text-[#b8956f]">
            {lastScan.fields} fields · {lastScan.buttons} buttons · {lastScan.links} links · {lastScan.errors} errors ({lastScan.method})
          </p>
        )}
      </div>
    )
  }

  if (streamingText) {
    const formatted = formatAgentOutput(streamingText)
    return (
      <div className="rounded-xl border border-[#4a3728] bg-[#1a1410]/40 p-4">
        <p className="text-sm text-[#f5e6c3] whitespace-pre-wrap leading-relaxed">{formatted}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#4a3728] bg-[#2a1f18]/60 backdrop-blur-sm p-4">
        <div className="text-xs text-[#d4b896] flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-[#d4b896] rounded-full animate-pulse" />
          Thinking...
        </div>
      </div>
    )
  }

  return null
}
