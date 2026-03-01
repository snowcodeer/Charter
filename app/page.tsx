'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessages, type ChatMessage, type ToolEvent } from '@/components/agent/ChatMessages'
import { ApprovalCardList, type ApprovalRequest } from '@/components/agent/ApprovalCard'
import { ConnectorStatus } from '@/components/agent/ConnectorStatus'
import { SiriOrb } from '@/components/agent/SiriOrb'
import { VoiceTranscript } from '@/components/agent/VoiceTranscript'
import { AgentTimeline, type PlanStep } from '@/components/agent/AgentTimeline'
import { PassportForm } from '@/components/agent/PassportForm'
import { useVoice } from '@/lib/hooks/useVoice'
import { OfficeScene } from '@/components/scene/OfficeScene'
import { GlobeTooltip } from '@/components/scene/globe/GlobeTooltip'
import { useGlobeStore } from '@/components/scene/globe/useGlobeStore'

// Common country name → ISO-3 for bridging agent results to the globe
const NAME_TO_ISO: Record<string, string> = {
  'united states': 'USA', 'united kingdom': 'GBR', 'canada': 'CAN',
  'australia': 'AUS', 'germany': 'DEU', 'france': 'FRA', 'japan': 'JPN',
  'south korea': 'KOR', 'singapore': 'SGP', 'india': 'IND', 'china': 'CHN',
  'brazil': 'BRA', 'mexico': 'MEX', 'italy': 'ITA', 'spain': 'ESP',
  'netherlands': 'NLD', 'switzerland': 'CHE', 'sweden': 'SWE',
  'norway': 'NOR', 'denmark': 'DNK', 'finland': 'FIN', 'ireland': 'IRL',
  'portugal': 'PRT', 'austria': 'AUT', 'belgium': 'BEL', 'greece': 'GRC',
  'poland': 'POL', 'turkey': 'TUR', 'russia': 'RUS', 'ukraine': 'UKR',
  'argentina': 'ARG', 'chile': 'CHL', 'colombia': 'COL', 'peru': 'PER',
  'egypt': 'EGY', 'south africa': 'ZAF', 'nigeria': 'NGA', 'kenya': 'KEN',
  'thailand': 'THA', 'vietnam': 'VNM', 'indonesia': 'IDN', 'malaysia': 'MYS',
  'philippines': 'PHL', 'pakistan': 'PAK', 'bangladesh': 'BGD',
  'saudi arabia': 'SAU', 'uae': 'ARE', 'united arab emirates': 'ARE',
  'qatar': 'QAT', 'israel': 'ISR', 'new zealand': 'NZL', 'taiwan': 'TWN',
  'hong kong': 'HKG', 'czech republic': 'CZE', 'czechia': 'CZE',
  'hungary': 'HUN', 'romania': 'ROU', 'croatia': 'HRV',
}

function resolveNationalityToIso(nationality: string): string | null {
  if (/^[A-Z]{3}$/.test(nationality)) return nationality
  return NAME_TO_ISO[nationality.toLowerCase()] || null
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [contextGathered, setContextGathered] = useState(false)

  // Orb transcript — persists the last assistant response
  const [orbTranscript, setOrbTranscript] = useState('')

  // Approval state
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null)
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'pending' | 'approved' | 'skipped'>>({})

  // Browser automation state
  const [browserActions, setBrowserActions] = useState<Array<{ tool: string; result: unknown }>>([])
  const [paymentGate, setPaymentGate] = useState<{ message: string; url: string } | null>(null)

  // What the user is currently saying (partial STT)
  const [userSpeaking, setUserSpeaking] = useState('')

  // Agent task timeline
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])
  const [orbHovered, setOrbHovered] = useState(false)
  const [showPassport, setShowPassport] = useState(false)

  // Action triage mode — agent acts without asking for approval
  const [actionMode, setActionMode] = useState(false)

  // Token usage tracking
  const [tokenUsage, setTokenUsage] = useState<{ input: number; output: number; total: number; limit: number } | null>(null)

  // Globe store
  const { setArcs, setMarkers, clearAll: clearGlobe, setSelectedNationality, setHighlightedCountries, setFocusTarget } = useGlobeStore()

  const bottomRef = useRef<HTMLDivElement>(null)
  const sendMessageRef = useRef<(text: string) => void>(() => {})
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages
  // Monotonically increasing run ID — used to prevent the finally block of an old
  // sendMessage from clobbering the state of a newer one, and to prevent concurrent sends.
  const runIdRef = useRef(0)

  // Voice hook
  const voice = useVoice({
    onTranscript: (text) => {
      setUserSpeaking('')
      sendMessageRef.current(text)
    },
    onPartialTranscript: (text) => {
      setUserSpeaking(text)
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, streamingThinking, toolEvents, approvalRequest])

  function handlePause() {
    // Bump runId so the old sendMessage's finally block won't clobber state
    runIdRef.current++
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsLoading(false)
    // Commit whatever text was streamed so far
    setStreamingText(prev => {
      if (prev) {
        setMessages(msgs => [...msgs, { role: 'assistant', content: prev + '\n\n*[paused by user]*' }])
      }
      return ''
    })
    setStreamingThinking('')
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    // Abort any existing run (synchronous, ref-based — no stale closure issues)
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    // Claim a new run ID — the finally block of any older run will see a mismatch and skip
    const thisRunId = ++runIdRef.current

    setInput('')
    setIsLoading(true)
    setToolEvents([])
    setStreamingText('')
    setStreamingThinking('')
    setContextGathered(false)
    setApprovalRequest(null)
    setActionStatuses({})
    setPaymentGate(null)
    setOrbTranscript('')
    // Don't clear planSteps and browserActions — keep previous context visible

    const userMessage: ChatMessage = { role: 'user', content: text }
    // Use ref to always get latest messages (avoids stale closure after pause)
    const updatedMessages = [...messagesRef.current, userMessage]
    setMessages(updatedMessages)

    const useVoiceMode = voice.voiceMode

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          voiceMode: useVoiceMode,
          actionMode,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let fullThinking = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let payload
          try {
            payload = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (payload.event === 'thinking') {
            fullThinking += payload.data.text
            setStreamingThinking(fullThinking)
          } else if (payload.event === 'text') {
            fullText += payload.data.text
            setStreamingText(fullText)
            setOrbTranscript(fullText)
          } else if (payload.event === 'tool_call') {
            setToolEvents((prev) => [...prev, { type: 'tool_call', name: payload.data.name, data: payload.data.input }])
          } else if (payload.event === 'tool_start') {
            setToolEvents((prev) => [...prev, { type: 'tool_start', name: payload.data.name, data: null }])
            // Mark next pending plan step as active when browser work starts
            const browserToolNames = ['browser_navigate', 'browser_fill_fields', 'browser_click', 'browser_scan_page', 'browser_read_page']
            if (browserToolNames.includes(payload.data.name)) {
              setPlanSteps(prev => {
                const firstPending = prev.findIndex(s => s.status === 'pending')
                if (firstPending >= 0) {
                  return prev.map((s, i) => i === firstPending ? { ...s, status: 'active' as const } : s)
                }
                return prev
              })
            }
          } else if (payload.event === 'tool_result') {
            setToolEvents((prev) => [...prev, { type: 'tool_result', name: payload.data.name, data: payload.data.result }])
            // Handle passport profile tool results → highlight on globe
            if (
              (payload.data.name === 'get_passport_profile' || payload.data.name === 'update_passport_profile') &&
              payload.data.result?.passports?.length > 0
            ) {
              const nationality = payload.data.result.passports[0].nationality
              const iso = resolveNationalityToIso(nationality)
              if (iso) setSelectedNationality(iso)
            }
            // Handle globe visualization tool
            if (payload.data.name === 'show_on_globe' && payload.data.result?.action === 'show_on_globe') {
              const result = payload.data.result
              if (result.clear) clearGlobe()
              if (result.arcs?.length) {
                setArcs(result.arcs.map((a: { from: { lat: number; lng: number; label?: string }; to: { lat: number; lng: number; label?: string } }, i: number) => ({
                  id: `arc-${Date.now()}-${i}`,
                  from: a.from,
                  to: a.to,
                })))
              }
              if (result.markers?.length) {
                setMarkers(result.markers.map((m: { lat: number; lng: number; label: string; type?: string }, i: number) => ({
                  id: `marker-${Date.now()}-${i}`,
                  lat: m.lat,
                  lng: m.lng,
                  label: m.label,
                  type: m.type || 'destination',
                })))
              }
              if (result.highlightCountries?.length) {
                setHighlightedCountries(result.highlightCountries)
              }
              // Focus globe on the midpoint of arcs (flight path centre), falling back to markers
              if (result.arcs?.length) {
                const arcPoints: { lat: number; lng: number }[] = []
                for (const a of result.arcs) {
                  arcPoints.push({ lat: (a.from.lat + a.to.lat) / 2, lng: (a.from.lng + a.to.lng) / 2 })
                }
                const avgLat = arcPoints.reduce((s, p) => s + p.lat, 0) / arcPoints.length
                const avgLng = arcPoints.reduce((s, p) => s + p.lng, 0) / arcPoints.length
                setFocusTarget({ lat: avgLat, lng: avgLng })
              } else if (result.markers?.length) {
                const avgLat = result.markers.reduce((s: number, m: { lat: number }) => s + m.lat, 0) / result.markers.length
                const avgLng = result.markers.reduce((s: number, m: { lng: number }) => s + m.lng, 0) / result.markers.length
                setFocusTarget({ lat: avgLat, lng: avgLng })
              }
            }
          } else if (payload.event === 'context_gathered') {
            setContextGathered(true)
          } else if (payload.event === 'approval_request') {
            if (fullText) {
              setMessages((prev) => [...prev, { role: 'assistant', content: fullText, thinking: fullThinking || undefined }])
              fullText = ''
              fullThinking = ''
              setStreamingText('')
              setStreamingThinking('')
            }
            const req = payload.data as ApprovalRequest
            setApprovalRequest(req)
            const statuses: Record<string, 'pending'> = {}
            req.actions.forEach((a) => { statuses[a.id] = 'pending' })
            setActionStatuses(statuses)
          } else if (payload.event === 'browser_action') {
            setBrowserActions((prev) => [...prev, payload.data])
          } else if (payload.event === 'scan_log') {
            // Log scan details to console for debugging
            const sl = payload.data as Record<string, unknown>
            console.log(`[Charter Scan] ${sl.fields} fields, ${sl.buttons} buttons, ${sl.links} links, method: ${sl.method}`)
            if (Array.isArray(sl.log)) console.log('[Charter Scan Log]', (sl.log as string[]).join('\n'))
          } else if (payload.event === 'payment_gate') {
            setPaymentGate(payload.data as { message: string; url: string })
          } else if (payload.event === 'plan') {
            const plan = payload.data as { steps: Array<{ id: string; title: string; proof: string }> }
            setPlanSteps(plan.steps.map(s => ({ ...s, status: 'pending' as const })))
          } else if (payload.event === 'plan_update') {
            const update = payload.data as { stepId: string; summary: string; screenshot?: string }
            setPlanSteps(prev => prev.map(s =>
              s.id === update.stepId
                ? { ...s, status: 'done' as const, summary: update.summary, screenshot: update.screenshot || undefined }
                : s
            ))
          } else if (payload.event === 'plan_add_step') {
            const newStep = payload.data as { id: string; title: string; proof: string; afterStepId?: string }
            setPlanSteps(prev => {
              const step: PlanStep = { id: newStep.id, title: newStep.title, proof: newStep.proof, status: 'pending' }
              if (newStep.afterStepId) {
                const idx = prev.findIndex(s => s.id === newStep.afterStepId)
                if (idx >= 0) {
                  const next = [...prev]
                  next.splice(idx + 1, 0, step)
                  return next
                }
              }
              return [...prev, step]
            })
          } else if (payload.event === 'audio') {
            voice.handleAudioChunk(payload.data.audio)
          } else if (payload.event === 'audio_done') {
            voice.handleAudioDone()
          } else if (payload.event === 'token_usage') {
            setTokenUsage(payload.data as { input: number; output: number; total: number; limit: number })
          } else if (payload.event === 'done') {
            if (fullText) {
              setMessages((prev) => [...prev, { role: 'assistant', content: fullText, thinking: fullThinking || undefined }])
              setStreamingText('')
              setStreamingThinking('')
            }
            setToolEvents([])
          } else if (payload.event === 'error') {
            setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${payload.data.message}` }])
            setOrbTranscript(`Error: ${payload.data.message}`)
          }
        }
      }

      if (fullText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullText, thinking: fullThinking || undefined }])
        setStreamingText('')
        setStreamingThinking('')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User paused — already handled in handlePause
        return
      }
      const errMsg = `Connection error: ${err instanceof Error ? err.message : String(err)}`
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }])
      setOrbTranscript(errMsg)
    } finally {
      // Only clean up state if this is still the active run.
      // If a newer sendMessage has started, it owns isLoading/abortRef now.
      if (runIdRef.current === thisRunId) {
        abortRef.current = null
        setIsLoading(false)
        if (!approvalRequest) setToolEvents([])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalRequest, voice.voiceMode, actionMode, setArcs, setMarkers, clearGlobe, setSelectedNationality, setHighlightedCountries, setFocusTarget])

  sendMessageRef.current = sendMessage

  function handleApprove(id: string) {
    setActionStatuses((prev) => ({ ...prev, [id]: 'approved' }))
  }

  function handleSkip(id: string) {
    setActionStatuses((prev) => ({ ...prev, [id]: 'skipped' }))
  }

  function handleApproveAll() {
    if (!approvalRequest) return
    const statuses: Record<string, 'approved'> = {}
    approvalRequest.actions.forEach((a) => { statuses[a.id] = 'approved' })
    setActionStatuses(statuses)
  }

  function handleSubmitApprovals() {
    if (!approvalRequest) return
    const approved = approvalRequest.actions
      .filter((a) => actionStatuses[a.id] === 'approved')
      .map((a) => a.title)
    const skipped = approvalRequest.actions
      .filter((a) => actionStatuses[a.id] === 'skipped')
      .map((a) => a.title)

    let approvalMessage = '[APPROVED] ' + approved.join(', ')
    if (skipped.length > 0) {
      approvalMessage += '. [SKIPPED] ' + skipped.join(', ')
    }

    setApprovalRequest(null)
    setActionStatuses({})
    setToolEvents([])
    sendMessage(approvalMessage)
  }

  function handleOrbClick() {
    if (voice.isRecording) {
      voice.stopRecording()
    } else {
      voice.stopPlayback()
      voice.startRecording()
    }
  }

  const hasContent = messages.length > 0 || isLoading || streamingText

  return (
    <>
      {/* 3D Globe Scene — full background */}
      <OfficeScene />
      <GlobeTooltip />

      {/* ElevenLabs voice orb — top right */}
      <div
        className="fixed top-6 right-6 z-30 flex flex-col items-center gap-2"
        onMouseEnter={() => setOrbHovered(true)}
        onMouseLeave={() => setOrbHovered(false)}
      >
        {/* Status label */}
        <div className="h-4">
          {voice.isRecording ? (
            <span className="text-[10px] text-red-400 tracking-widest uppercase animate-pulse">Listening...</span>
          ) : isLoading && !streamingText ? (
            <span className="text-[10px] text-zinc-500 tracking-widest uppercase">Thinking...</span>
          ) : voice.isPlaying ? (
            <span className="text-[10px] text-purple-400 tracking-widest uppercase">Speaking...</span>
          ) : null}
        </div>

        {/* Partial STT transcript */}
        {userSpeaking && (
          <div className="px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg max-w-[200px]">
            <p className="text-[10px] text-zinc-400 italic text-center">{userSpeaking}</p>
          </div>
        )}

        <SiriOrb
          size={80}
          isListening={voice.isRecording}
          isSpeaking={voice.isPlaying}
          isThinking={isLoading && !streamingText}
          onClick={handleOrbClick}
        />

        {/* Voice toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !voice.voiceMode
            voice.setVoiceMode(next)
            if (!next) {
              voice.stopRecording()
              voice.stopPlayback()
            }
          }}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            voice.voiceMode
              ? 'bg-purple-600/20 border-purple-600 text-purple-400'
              : 'bg-black/40 border-zinc-700 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {voice.voiceMode ? 'voice on' : 'voice off'}
        </button>

        {/* Action mode toggle */}
        <button
          type="button"
          onClick={() => setActionMode(prev => !prev)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            actionMode
              ? 'bg-red-600/20 border-red-600 text-red-400 animate-pulse'
              : 'bg-black/40 border-zinc-700 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {actionMode ? 'action mode' : 'action off'}
        </button>
      </div>

      {/* Agent Timeline — shows on orb hover when plan exists */}
      <div className="fixed top-6 right-28 z-30">
        <AgentTimeline steps={planSteps} visible={orbHovered && planSteps.length > 0} />
      </div>

      {/* Connector status — top left */}
      <div className="fixed top-4 left-4 z-20">
        <ConnectorStatus />
      </div>

      {/* Token counter — bottom left */}
      {tokenUsage && (
        <div className="fixed bottom-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-zinc-800/50">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: tokenUsage.total / tokenUsage.limit < 0.5
                ? '#4ade80' : tokenUsage.total / tokenUsage.limit < 0.8
                ? '#facc15' : '#f87171',
            }}
          />
          <span className="text-[10px] font-mono text-zinc-500">
            {(tokenUsage.total / 1000).toFixed(1)}k
            <span className="text-zinc-700"> / </span>
            {(tokenUsage.limit / 1000).toFixed(0)}k
          </span>
        </div>
      )}


      {/* Chat overlay — bottom of screen */}
      <div className="fixed inset-x-0 bottom-0 z-10 pointer-events-none flex flex-col max-h-[60vh]">
        {/* Gradient fade into 3D scene */}
        <div className="h-12 bg-gradient-to-b from-transparent to-[#1a1410]/70 shrink-0" />

        <div className="bg-[#1a1410]/70 backdrop-blur-md flex flex-col min-h-0">
          {/* Messages area */}
          {hasContent && (
            <div className="flex-1 overflow-y-auto pointer-events-auto min-h-0">
              <ChatMessages
                messages={messages}
                toolEvents={toolEvents}
                isLoading={isLoading && !streamingText}
                streamingThinking={streamingThinking}
                contextGathered={contextGathered}
              />
              {streamingText && (
                <div className="flex justify-start px-4 pb-4">
                  <div className="max-w-[80%] bg-[#1e1612] border border-[#3d2e22] rounded-2xl px-4 py-2 text-sm text-[#e8dcc4] leading-relaxed">
                    <p className="whitespace-pre-wrap">{streamingText}</p>
                  </div>
                </div>
              )}

              {/* Approval Cards */}
              {approvalRequest && (
                <div className="pointer-events-auto">
                  <ApprovalCardList
                    request={approvalRequest}
                    actionStatuses={actionStatuses}
                    onApprove={handleApprove}
                    onSkip={handleSkip}
                    onApproveAll={handleApproveAll}
                    onSubmit={handleSubmitApprovals}
                  />
                </div>
              )}

              {/* Payment Gate */}
              {paymentGate && (
                <div className="flex justify-start px-4 pb-4 pointer-events-auto">
                  <div className="max-w-[85%] bg-amber-950/30 border border-amber-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">&#x1F4B3;</span>
                      <h4 className="text-sm font-medium text-amber-200">Payment Page Detected</h4>
                    </div>
                    <p className="text-xs text-amber-300/80">{paymentGate.message}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setPaymentGate(null)
                          sendMessage("[USER_CHOICE] I'll enter payment details myself. Continue with the rest.")
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium"
                      >
                        I&apos;ll enter payment myself
                      </button>
                      <button
                        onClick={() => {
                          setPaymentGate(null)
                          sendMessage("[USER_CHOICE] Find my payment info and fill it in.")
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-amber-700 text-amber-300"
                      >
                        Find my payment info
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Browser Action Status */}
              {browserActions.length > 0 && (
                <div className="flex justify-start px-4 pb-2">
                  <div className="max-w-[85%] space-y-1">
                    {browserActions.map((ba, i) => {
                      const r = ba.result as Record<string, unknown> | null
                      return (
                        <div key={i} className="text-xs font-mono flex items-center gap-1.5 text-zinc-500">
                          <span className="inline-block w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0" />
                          <span className={r?.error ? 'text-red-400' : 'text-purple-400'}>
                            {r?.error
                              ? `${ba.tool} failed: ${r.error}`
                              : ba.tool === 'browser_navigate' ? `navigated to ${r?.url || 'page'}`
                              : ba.tool === 'browser_scan_page' ? `scanned page — ${(r?.fields as unknown[])?.length || 0} fields, ${(r?.buttons as unknown[])?.length || 0} buttons${r?._scanMethod === 'axtree' ? ' (AXTree)' : ''}`
                              : ba.tool === 'browser_fill_fields' ? `filled ${(r?.results as unknown[])?.length || 0} fields`
                              : ba.tool === 'browser_click' ? `clicked "${r?.text || 'element'}"`
                              : ba.tool === 'browser_read_page' ? `reading page content`
                              : ba.tool
                            }
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          {/* Voice transcript — shows what agent is saying */}
          {orbTranscript && voice.isPlaying && (
            <div className="pointer-events-auto px-4 py-2">
              <VoiceTranscript text={orbTranscript} maxLines={3} />
            </div>
          )}

          {/* Playback indicator */}
          {voice.isPlaying && (
            <div className="flex items-center gap-1.5 px-6 py-1.5 pointer-events-auto">
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-purple-500 rounded-full animate-[voice-bar_0.6s_ease-in-out_infinite]" style={{ height: '40%' }} />
                <span className="w-0.5 bg-purple-500 rounded-full animate-[voice-bar_0.6s_ease-in-out_0.15s_infinite]" style={{ height: '70%' }} />
                <span className="w-0.5 bg-purple-500 rounded-full animate-[voice-bar_0.6s_ease-in-out_0.3s_infinite]" style={{ height: '100%' }} />
                <span className="w-0.5 bg-purple-500 rounded-full animate-[voice-bar_0.6s_ease-in-out_0.15s_infinite]" style={{ height: '60%' }} />
                <span className="w-0.5 bg-purple-500 rounded-full animate-[voice-bar_0.6s_ease-in-out_infinite]" style={{ height: '30%' }} />
              </div>
              <span className="text-[10px] text-purple-400">Speaking...</span>
            </div>
          )}

          {/* Input */}
          <div className="p-4 pointer-events-auto">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
              className="flex gap-2 items-center"
            >
              {/* Mic button (only in voice mode) */}
              {voice.voiceMode && (
                <button
                  type="button"
                  onClick={() => {
                    if (voice.isRecording) {
                      voice.stopRecording()
                    } else {
                      voice.stopPlayback()
                      voice.startRecording()
                    }
                  }}
                  className={`p-3 rounded-xl border transition-colors flex-shrink-0 ${
                    voice.isRecording
                      ? 'bg-red-600/20 border-red-600 text-red-400 animate-pulse'
                      : 'bg-zinc-900/80 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={voice.isRecording ? 'Stop recording' : 'Start recording'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
              )}

              {/* Pause button — visible while agent is working */}
              {isLoading && (
                <button
                  type="button"
                  onClick={handlePause}
                  className="p-3 rounded-xl border border-amber-700 bg-amber-950/40 text-amber-400 hover:bg-amber-900/40 transition-colors flex-shrink-0"
                  title="Pause agent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                </button>
              )}

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isLoading ? 'Type to pause & add context...' : voice.isRecording ? 'Listening...' : 'Ask about travel, visas, flights...'}
                className="flex-1 bg-[#1e1612] border border-[#4a382a] rounded-xl px-4 py-3 text-sm text-[#e8dcc4] placeholder-[#6b5a46] focus:outline-none focus:border-[#c4a455]"
              />
              <button
                type="button"
                onClick={() => setShowPassport((v) => !v)}
                className="bg-[#2a1f18] border border-[#3d2e22] text-[#e8dcc4] px-3 py-3 rounded-xl text-sm hover:bg-[#3d2e22] transition-colors"
                title="Passport & Visa Info"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M7 20v-2a5 5 0 0 1 10 0v2" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={!input.trim()}
                className="bg-[#c4a455] text-[#1a1410] px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-[#d4b465] transition-colors"
              >
                {isLoading ? 'Send' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
      {showPassport && (
        <PassportForm
          onClose={() => setShowPassport(false)}
          onSaved={(iso) => {
            setMessages((prev) => [...prev, {
              role: 'assistant',
              content: `Passport updated. Globe now showing visa requirements for ${iso} passport holders.`,
            }])
          }}
        />
      )}
    </>
  )
}
