'use client'

import { useMemo } from 'react'
import { ParchmentSidebar } from '@/components/agent/ParchmentSidebar'
import { formatAgentOutput } from '@/components/agent/formatAgentOutput'
import type { ChatMessage } from '@/components/agent/ChatMessages'
import type { PlanStep } from '@/components/agent/AgentTimeline'
import type { ActionHistoryItem } from '@/components/agent/executionTypes'

interface TokenUsage {
  input: number
  output: number
  total: number
  limit: number
}

export interface GlobeSidebarsProps {
  messages: ChatMessage[]
  streamingThinking: string
  streamingText: string
  actionHistory: ActionHistoryItem[]
  planSteps: PlanStep[]
  tokenUsage: TokenUsage | null
  isLoading: boolean
  voiceIsRecording: boolean
  voiceIsPlaying: boolean
}

/* ── Helpers (mirrored from ReasoningDrawer) ── */

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
    plan_steps: 'Created plan',
    add_plan_step: 'Added plan step',
    complete_step: 'Completed step',
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
    return url ? `→ ${url}` : 'Navigating…'
  }
  if (item.name === 'search_web') {
    const query = typeof data.query === 'string' ? data.query : ''
    return query ? `"${query}"` : 'Searching…'
  }
  return item.type === 'tool_start' ? 'Started' : item.type === 'tool_result' ? 'Finished' : 'Prepared'
}

/* ── Parchment section heading ── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: '#6b5344', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
      {children}
    </p>
  )
}

/* ── Component ── */

export function GlobeSidebars(props: GlobeSidebarsProps) {
  const {
    messages,
    streamingThinking,
    streamingText,
    actionHistory,
    planSteps,
    tokenUsage,
    isLoading,
    voiceIsRecording,
    voiceIsPlaying,
  } = props

  const recentActions = useMemo(() => actionHistory.slice(-30), [actionHistory])

  // Sidebars slide in only after the user has sent at least one message
  const hasInteracted = messages.length > 0 || isLoading

  return (
    <>
      {/* ═══ LEFT SIDEBAR ═══ */}
      <ParchmentSidebar side="left" open={hasInteracted}>
        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {voiceIsRecording && (
            <span
              className="px-3 py-1 rounded-full border border-red-700/40 bg-red-100/40 animate-pulse"
              style={{ fontSize: 14, color: '#991b1b' }}
            >
              Listening…
            </span>
          )}
          {voiceIsPlaying && (
            <span
              className="px-3 py-1 rounded-full border border-purple-700/40 bg-purple-100/40"
              style={{ fontSize: 14, color: '#6b21a8' }}
            >
              Speaking…
            </span>
          )}
          {isLoading && !streamingText && !voiceIsRecording && (
            <span
              className="px-3 py-1 rounded-full border border-amber-700/40 bg-amber-100/40"
              style={{ fontSize: 14, color: '#92400e' }}
            >
              Thinking…
            </span>
          )}
          {isLoading && streamingText && (
            <span
              className="px-3 py-1 rounded-full border border-emerald-700/40 bg-emerald-100/40"
              style={{ fontSize: 14, color: '#065f46' }}
            >
              Streaming…
            </span>
          )}
        </div>

        {/* Token usage */}
        {tokenUsage && (
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: tokenUsage.total / tokenUsage.limit < 0.5
                  ? '#16a34a' : tokenUsage.total / tokenUsage.limit < 0.8
                  ? '#ca8a04' : '#dc2626',
              }}
            />
            <span style={{ fontSize: 16, fontFamily: 'monospace', color: '#4a3728' }}>
              {(tokenUsage.total / 1000).toFixed(1)}k
              <span style={{ color: '#8b7355' }}> / </span>
              {(tokenUsage.limit / 1000).toFixed(0)}k tokens
            </span>
          </div>
        )}

        {/* Divider */}
        <hr style={{ borderColor: 'rgba(139,115,85,0.3)' }} />

        {/* Message history (parchment-styled) */}
        <div>
          <SectionTitle>Chat History</SectionTitle>
          {messages.length === 0 ? (
            <p style={{ fontSize: 16, color: '#8b7355', fontStyle: 'italic', marginTop: 4 }}>No messages yet.</p>
          ) : (
            <div style={{ marginTop: 8, maxHeight: '50vh', overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((msg, i) => {
                const formatted = formatAgentOutput(msg.content)
                if (!formatted) return null
                return (
                  <article
                    key={`${msg.role}-${i}`}
                    className="rounded-md border"
                    style={{
                      padding: 12,
                      borderColor: '#8b7355',
                      backgroundColor: msg.role === 'user' ? 'rgba(42,31,24,0.08)' : 'rgba(42,31,24,0.04)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: msg.role === 'user' ? '#4a3728' : '#6b5344',
                      }}
                    >
                      {msg.role === 'user' ? 'You' : 'Agent'}
                    </span>
                    <p style={{ fontSize: 16, lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap', color: '#2a1f18' }}>
                      {formatted}
                    </p>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </ParchmentSidebar>

      {/* ═══ RIGHT SIDEBAR ═══ */}
      <ParchmentSidebar side="right" open={hasInteracted}>
        {/* Live reasoning */}
        <div>
          <SectionTitle>Reasoning</SectionTitle>
          <div style={{ marginTop: 6, maxHeight: '20vh', overflowY: 'auto', paddingRight: 4 }}>
            {streamingThinking ? (
              <pre style={{ fontSize: 15, lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#4a3728' }}>
                {streamingThinking}
              </pre>
            ) : (
              <p style={{ fontSize: 16, fontStyle: 'italic', color: '#8b7355' }}>
                {isLoading ? 'Waiting for reasoning…' : 'No active reasoning.'}
              </p>
            )}
          </div>
        </div>

        <hr style={{ borderColor: 'rgba(139,115,85,0.3)' }} />

        {/* Action history */}
        <div>
          <SectionTitle>Actions</SectionTitle>
          {recentActions.length === 0 ? (
            <p style={{ fontSize: 16, fontStyle: 'italic', color: '#8b7355', marginTop: 4 }}>No actions yet.</p>
          ) : (
            <div style={{ marginTop: 6, maxHeight: '15vh', overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentActions.map((item) => (
                <div key={item.id} style={{ fontSize: 15, lineHeight: 1.4, color: '#4a3728' }}>
                  <span style={{ color: '#6b5344' }}>{toolLabel(item.name)}</span>
                  {' — '}
                  <span style={{ color: '#8b7355' }}>{actionSummary(item)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan steps (parchment-styled inline) */}
        {planSteps.length > 0 && (
          <>
            <hr style={{ borderColor: 'rgba(139,115,85,0.3)' }} />
            <div>
              <div className="flex items-center justify-between">
                <SectionTitle>Plan</SectionTitle>
                <span style={{ fontSize: 14, color: '#8b7355' }}>
                  {planSteps.filter(s => s.status === 'done').length}/{planSteps.length}
                </span>
              </div>
              <div style={{ marginTop: 6, maxHeight: '15vh', overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {planSteps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-md border"
                    style={{ padding: 10, borderColor: 'rgba(139,115,85,0.4)', backgroundColor: 'rgba(42,31,24,0.06)' }}
                  >
                    <div className="flex items-center gap-2">
                      {step.status === 'done' ? (
                        <span style={{ fontSize: 16, color: '#16a34a' }}>✓</span>
                      ) : step.status === 'active' ? (
                        <span className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
                      ) : (
                        <span style={{ fontSize: 16, color: '#8b7355' }}>○</span>
                      )}
                      <span style={{ fontSize: 16, color: '#2a1f18' }}>{step.title}</span>
                    </div>
                    {step.summary && (
                      <p style={{ fontSize: 14, marginTop: 2, color: '#16a34a' }}>{step.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </ParchmentSidebar>
    </>
  )
}
