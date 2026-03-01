'use client'

import { useMemo, useState, useEffect } from 'react'
import { DestinationSearch } from '@/components/agent/DestinationSearch'
import { formatAgentOutput } from '@/components/agent/formatAgentOutput'
import { useGlobeStore } from '@/components/scene/globe/useGlobeStore'
import type { ChatMessage } from '@/components/agent/ChatMessages'
import type { PlanStep } from '@/components/agent/AgentTimeline'
import type { ActionHistoryItem } from '@/components/agent/executionTypes'
import type { ConsultationState } from '@/lib/hooks/useConsultationState'

interface TokenUsage {
  input: number
  output: number
  total: number
  limit: number
}

type RightTab = 'reasoning' | 'passport'

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
  // Chat input props (kept for interface compat, used elsewhere)
  inputValue: string
  onInputChange: (value: string) => void
  onSubmitMessage: (text: string) => void
  onMicClick: () => void
  isListening: boolean
  voiceMode: boolean
  passportMissing: boolean
  consultationState: ConsultationState
  onPassportSaved?: (iso: string) => void
}

/* ── Helpers ── */

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[#9a8a6e] uppercase tracking-wider font-semibold">
      {children}
    </p>
  )
}

/* ── Inline Passport Form (dark) ── */
function InlinePassportForm({ onSaved }: { onSaved?: (iso: string) => void }) {
  const [search, setSearch] = useState('')
  const [selectedIso, setSelectedIso] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const setSelectedNationality = useGlobeStore((s) => s.setSelectedNationality)

  const COUNTRIES = useMemo(() => [
    { name: 'United States', iso3: 'USA' }, { name: 'United Kingdom', iso3: 'GBR' },
    { name: 'Canada', iso3: 'CAN' }, { name: 'Australia', iso3: 'AUS' },
    { name: 'Germany', iso3: 'DEU' }, { name: 'France', iso3: 'FRA' },
    { name: 'Japan', iso3: 'JPN' }, { name: 'South Korea', iso3: 'KOR' },
    { name: 'Singapore', iso3: 'SGP' }, { name: 'India', iso3: 'IND' },
    { name: 'China', iso3: 'CHN' }, { name: 'Brazil', iso3: 'BRA' },
    { name: 'Mexico', iso3: 'MEX' }, { name: 'Italy', iso3: 'ITA' },
    { name: 'Spain', iso3: 'ESP' }, { name: 'Netherlands', iso3: 'NLD' },
    { name: 'Switzerland', iso3: 'CHE' }, { name: 'Sweden', iso3: 'SWE' },
    { name: 'Norway', iso3: 'NOR' }, { name: 'Denmark', iso3: 'DNK' },
    { name: 'Ireland', iso3: 'IRL' }, { name: 'Portugal', iso3: 'PRT' },
    { name: 'Austria', iso3: 'AUT' }, { name: 'Belgium', iso3: 'BEL' },
    { name: 'Greece', iso3: 'GRC' }, { name: 'Poland', iso3: 'POL' },
    { name: 'Turkey', iso3: 'TUR' }, { name: 'Thailand', iso3: 'THA' },
    { name: 'Indonesia', iso3: 'IDN' }, { name: 'Malaysia', iso3: 'MYS' },
    { name: 'Philippines', iso3: 'PHL' }, { name: 'Vietnam', iso3: 'VNM' },
    { name: 'Taiwan', iso3: 'TWN' }, { name: 'Hong Kong', iso3: 'HKG' },
    { name: 'New Zealand', iso3: 'NZL' }, { name: 'Argentina', iso3: 'ARG' },
    { name: 'Colombia', iso3: 'COL' }, { name: 'South Africa', iso3: 'ZAF' },
    { name: 'Nigeria', iso3: 'NGA' }, { name: 'Egypt', iso3: 'EGY' },
    { name: 'UAE', iso3: 'ARE' }, { name: 'Saudi Arabia', iso3: 'SAU' },
    { name: 'Israel', iso3: 'ISR' }, { name: 'Russia', iso3: 'RUS' },
    { name: 'Ukraine', iso3: 'UKR' }, { name: 'Czech Republic', iso3: 'CZE' },
    { name: 'Hungary', iso3: 'HUN' }, { name: 'Romania', iso3: 'ROU' },
    { name: 'Finland', iso3: 'FIN' }, { name: 'Croatia', iso3: 'HRV' },
  ], [])

  // Load existing profile on mount
  useEffect(() => {
    fetch('/api/passport')
      .then(r => r.json())
      .then(data => {
        if (data?.passports?.length > 0) {
          const nat = data.passports[0].nationality
          const match = COUNTRIES.find(c =>
            c.name.toLowerCase() === nat.toLowerCase() || c.iso3 === nat
          )
          if (match) {
            setSelectedIso(match.iso3)
            setSearch(match.name)
            setSelectedNationality(match.iso3)
          }
        }
      })
      .catch(() => {})
  }, [COUNTRIES, setSelectedNationality])

  const filtered = useMemo(() => {
    if (!search) return COUNTRIES
    const q = search.toLowerCase()
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q))
  }, [search, COUNTRIES])

  const selectedCountry = COUNTRIES.find(c => c.iso3 === selectedIso)

  async function handleSave() {
    if (!selectedIso || !selectedCountry) return
    setSaving(true)
    try {
      await fetch('/api/passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User',
          passports: [{ nationality: selectedCountry.name, issuingCountry: selectedCountry.name }],
        }),
      })
      setSelectedNationality(selectedIso)
      onSaved?.(selectedIso)
    } catch (err) {
      console.error('Failed to save passport:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle>Passport</SectionTitle>
      <div className="mt-1.5 relative">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setSelectedIso('') }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search nationality..."
          className="w-full bg-[#1e1612]/80 border border-[#4a382a] rounded-lg px-3 py-2 text-sm text-[#e8dcc4] placeholder-[#6b5a46] focus:outline-none focus:border-[#c4a455]"
        />
        {showDropdown && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#1e1612]/80 border border-[#4a382a] rounded-lg z-30">
            {filtered.slice(0, 20).map((c) => (
              <button
                key={c.iso3}
                type="button"
                onClick={() => { setSelectedIso(c.iso3); setSearch(c.name); setShowDropdown(false) }}
                className="w-full text-left px-3 py-1.5 text-sm text-[#e8dcc4] hover:bg-[#2a1f18] transition-colors"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        {selectedCountry && (
          <>
            <button
              type="button"
              onClick={() => { if (selectedIso) setSelectedNationality(selectedIso) }}
              className="flex-1 bg-[#2a1f18] text-[#e8dcc4] border border-[#3d2e22] px-3 py-1.5 rounded-lg text-sm hover:bg-[#3d2e22] transition-colors"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[#c4a455] text-[#1a1410] px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-30 hover:bg-[#d4b465] transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>

      {/* Visa legend */}
      <div className="mt-2 pt-2 border-t border-[#3d2e22]">
        <p className="text-xs text-[#6b5a46] mb-1.5">Visa Requirements</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#c4a455]" />
            <span className="text-[#e8dcc4]">Visa-free</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#b08040]" />
            <span className="text-[#e8dcc4]">VOA / eTA</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#8b4040]" />
            <span className="text-[#e8dcc4]">Visa required</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4a6a8a]" />
            <span className="text-[#e8dcc4]">Home</span>
          </span>
        </div>
      </div>
    </div>
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
    onPassportSaved,
  } = props

  const recentActions = useMemo(() => actionHistory.slice(-30), [actionHistory])
  const [rightTab, setRightTab] = useState<RightTab>('passport')

  const hasInteracted = messages.length > 0 || isLoading

  return (
    <>
      {/* ═══ LEFT PANEL ═══ */}
      <div
        className="fixed left-4 top-4 bottom-4 z-20 w-[320px] bg-[#1a1410]/70 backdrop-blur-xl border border-[#3d2e22] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-4 space-y-3 h-full flex flex-col overflow-hidden">
          {!hasInteracted ? (
            /* ── Welcome state for first-time users ── */
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-2">
              <div className="w-12 h-12 rounded-full border border-[#c4a455]/40 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c4a455" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[#e8dcc4] mb-2">Welcome to Charter</h3>
                <p className="text-xs text-[#9a8a6e] leading-relaxed">
                  Tell me where you would like to travel. I can help with visa requirements, flight routes, and travel planning.
                </p>
              </div>
              <div className="w-full space-y-2">
                <p className="text-[10px] text-[#6b5a46] uppercase tracking-wider">Try saying</p>
                <div className="space-y-1.5">
                  {[
                    'I want to travel to Japan',
                    'Find flights from London to New York',
                    'What visa do I need for Thailand?',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => props.onSubmitMessage(suggestion)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-[#3d2e22] text-xs text-[#d4b896] hover:bg-[#2a1f18] hover:border-[#6b5344] transition-colors"
                    >
                      &ldquo;{suggestion}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-[#6b5a46]">
                Set your passport nationality in the right panel to see visa requirements on the globe.
              </p>
            </div>
          ) : (
            <>
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {voiceIsRecording && (
              <span className="px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-xs text-red-400 animate-pulse">
                Listening…
              </span>
            )}
            {voiceIsPlaying && (
              <span className="px-2 py-0.5 rounded-full border border-purple-500/40 bg-purple-500/10 text-xs text-purple-400">
                Speaking…
              </span>
            )}
            {isLoading && !streamingText && !voiceIsRecording && (
              <span className="px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-xs text-amber-400">
                Thinking…
              </span>
            )}
            {isLoading && streamingText && (
              <span className="px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-400">
                Streaming…
              </span>
            )}
          </div>

          {/* Token usage */}
          {tokenUsage && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: tokenUsage.total / tokenUsage.limit < 0.5
                    ? '#16a34a' : tokenUsage.total / tokenUsage.limit < 0.8
                    ? '#ca8a04' : '#dc2626',
                }}
              />
              <span className="text-xs font-mono text-[#9a8a6e]">
                {(tokenUsage.total / 1000).toFixed(1)}k
                <span className="text-[#6b5a46]"> / </span>
                {(tokenUsage.limit / 1000).toFixed(0)}k tokens
              </span>
            </div>
          )}

          {/* Chat history */}
          <div className="flex-1 min-h-0 flex flex-col">
            <SectionTitle>Chat History</SectionTitle>
            {messages.length === 0 ? (
              <p className="text-sm italic text-[#6b5a46] mt-1">No messages yet.</p>
            ) : (
              <div className="mt-1.5 flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
                {messages.map((msg, i) => {
                  const formatted = formatAgentOutput(msg.content)
                  if (!formatted) return null
                  return (
                    <article
                      key={`${msg.role}-${i}`}
                      className="rounded-lg border border-[#3d2e22] p-2"
                      style={{
                        backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                      }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9a8a6e]">
                        {msg.role === 'user' ? 'You' : 'Agent'}
                      </span>
                      <p className="text-sm leading-relaxed mt-0.5 whitespace-pre-wrap text-[#e8dcc4]">
                        {formatted}
                      </p>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div className="fixed right-4 top-4 z-20 w-[300px] bg-[#1a1410]/70 backdrop-blur-xl border border-[#3d2e22] rounded-2xl shadow-2xl overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-[#3d2e22]">
          <button
            type="button"
            onClick={() => setRightTab('passport')}
            className="flex-1 py-2.5 text-center transition-colors"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: rightTab === 'passport' ? '#e8dcc4' : '#6b5a46',
              backgroundColor: rightTab === 'passport' ? 'rgba(255,255,255,0.05)' : 'transparent',
            }}
          >
            Passport & Route
          </button>
          <button
            type="button"
            onClick={() => setRightTab('reasoning')}
            className="flex-1 py-2.5 text-center transition-colors"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: rightTab === 'reasoning' ? '#e8dcc4' : '#6b5a46',
              backgroundColor: rightTab === 'reasoning' ? 'rgba(255,255,255,0.05)' : 'transparent',
            }}
          >
            Reasoning
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {rightTab === 'passport' ? (
            <>
              <InlinePassportForm onSaved={onPassportSaved} />
              <hr className="border-[#3d2e22]" />
              <DestinationSearch inline variant="dark" />
            </>
          ) : (
            <>
              {/* Live reasoning */}
              <div>
                <SectionTitle>Reasoning</SectionTitle>
                <div className="mt-1 max-h-[20vh] overflow-y-auto pr-1">
                  {streamingThinking ? (
                    <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap text-[#e8dcc4]">
                      {streamingThinking}
                    </pre>
                  ) : (
                    <p className="text-sm italic text-[#6b5a46]">
                      {isLoading ? 'Waiting for reasoning…' : 'No active reasoning.'}
                    </p>
                  )}
                </div>
              </div>

              <hr className="border-[#3d2e22]" />

              {/* Action history */}
              <div>
                <SectionTitle>Actions</SectionTitle>
                {recentActions.length === 0 ? (
                  <p className="text-sm italic text-[#6b5a46] mt-1">No actions yet.</p>
                ) : (
                  <div className="mt-1 max-h-[15vh] overflow-y-auto pr-1 flex flex-col gap-1">
                    {recentActions.map((item) => (
                      <div key={item.id} className="text-xs leading-snug text-[#e8dcc4]">
                        <span className="text-[#9a8a6e]">{toolLabel(item.name)}</span>
                        {' — '}
                        <span className="text-[#6b5a46]">{actionSummary(item)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan steps */}
              {planSteps.length > 0 && (
                <>
                  <hr className="border-[#3d2e22]" />
                  <div>
                    <div className="flex items-center justify-between">
                      <SectionTitle>Plan</SectionTitle>
                      <span className="text-xs text-[#6b5a46]">
                        {planSteps.filter(s => s.status === 'done').length}/{planSteps.length}
                      </span>
                    </div>
                    <div className="mt-1 max-h-[15vh] overflow-y-auto pr-1 flex flex-col gap-1.5">
                      {planSteps.map((step) => (
                        <div key={step.id} className="rounded-md border border-[#3d2e22] p-2 bg-[#2a1f18]/50">
                          <div className="flex items-center gap-1.5">
                            {step.status === 'done' ? (
                              <span className="text-sm text-green-500">✓</span>
                            ) : step.status === 'active' ? (
                              <span className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                            ) : (
                              <span className="text-sm text-[#6b5a46]">○</span>
                            )}
                            <span className="text-sm text-[#e8dcc4]">{step.title}</span>
                          </div>
                          {step.summary && (
                            <p className="text-xs mt-0.5 text-green-500">{step.summary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
