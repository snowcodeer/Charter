'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { type ChatMessage } from '@/components/agent/ChatMessages'
import { type ApprovalRequest } from '@/components/agent/ApprovalCard'
import { ApprovalFlow } from '@/components/agent/ApprovalFlow'
import { ConnectorStatus } from '@/components/agent/ConnectorStatus'
import { type PlanStep } from '@/components/agent/AgentTimeline'
import { PassportForm } from '@/components/agent/PassportForm'
import { ConsultationInput } from '@/components/agent/ConsultationInput'
import { ExecutionPage } from '@/components/agent/ExecutionPage'
import type { ActionHistoryItem, FillField, LiveActivityState, ScanSummary } from '@/components/agent/executionTypes'
import { useConsultationState } from '@/lib/hooks/useConsultationState'
import { useVoice } from '@/lib/hooks/useVoice'
import { OfficeScene } from '@/components/scene/OfficeScene'
import { useCrystalBallStore } from '@/lib/hooks/useCrystalBallStore'
import { GlobeTooltip } from '@/components/scene/globe/GlobeTooltip'
import { useGlobeStore } from '@/components/scene/globe/useGlobeStore'
import { GlobeSidebars } from '@/components/agent/GlobeSidebars'

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
  const [mode, setMode] = useState<'globe' | 'execution'>('globe')
  const [missionTitle, setMissionTitle] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([])
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null)
  const [lastScan, setLastScan] = useState<ScanSummary | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')

  // Approval state
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null)
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'pending' | 'approved' | 'skipped'>>({})

  // Browser automation state
  const [paymentGate, setPaymentGate] = useState<{ message: string; url: string } | null>(null)

  // What the user is currently saying (partial STT)
  const [userSpeaking, setUserSpeaking] = useState('')

  // Agent task timeline
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])
  const [showPassport, setShowPassport] = useState(false)
  const [hasPassportProfile, setHasPassportProfile] = useState(false)

  // Action triage mode — agent acts without asking for approval
  const [actionMode, setActionMode] = useState(false)

  // Token usage tracking
  const [tokenUsage, setTokenUsage] = useState<{ input: number; output: number; total: number; limit: number } | null>(null)

  // Globe store
  const { setArcs, setMarkers, clearAll: clearGlobe, setSelectedNationality, setHighlightedCountries, setFocusTarget } = useGlobeStore()

  const sendMessageRef = useRef<(text: string) => void>(() => {})
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages
  // Monotonically increasing run ID — used to prevent the finally block of an old
  // sendMessage from clobbering the state of a newer one, and to prevent concurrent sends.
  const runIdRef = useRef(0)
  const eventCounterRef = useRef(0)

  function pushActionHistory(type: ActionHistoryItem['type'], name: string, data: unknown) {
    const id = `${Date.now()}-${++eventCounterRef.current}`
    setActionHistory((prev) => [...prev, { id, ts: Date.now(), type, name, data }])
  }

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

  // Sync voice state → crystal ball store
  const crystalBall = useCrystalBallStore()
  useEffect(() => {
    crystalBall.setIsListening(voice.isRecording)
  }, [voice.isRecording])
  useEffect(() => {
    crystalBall.setIsSpeaking(voice.isPlaying)
  }, [voice.isPlaying])
  useEffect(() => {
    crystalBall.setIsThinking(voice.voiceMode && isLoading && !streamingText)
  }, [isLoading, streamingText])
  useEffect(() => {
    crystalBall.setVoiceMode(voice.voiceMode)
  }, [voice.voiceMode])
  useEffect(() => {
    crystalBall.setOnCrystalClick(() => {
      // Enable voice mode on first crystal ball click
      if (!voice.voiceMode) {
        voice.setVoiceMode(true)
      }
      if (voice.isRecording) {
        voice.stopRecording()
      } else {
        voice.stopPlayback()
        voice.startRecording()
      }
    })
    return () => crystalBall.setOnCrystalClick(null)
  }, [voice.voiceMode, voice.isRecording])

  const consultationState = useConsultationState({
    isRecording: voice.isRecording,
    isLoading,
    streamingText,
  })

  useEffect(() => {
    let active = true

    fetch('/api/passport')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        setHasPassportProfile(Boolean(data?.passports?.length))
      })
      .catch(() => {
        if (!active) return
        setHasPassportProfile(false)
      })

    return () => {
      active = false
    }
  }, [])

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
      if (prev.trim()) {
        setMessages(msgs => [...msgs, { role: 'assistant', content: `${prev.trim()}\n\n(paused by user)` }])
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
    setMissionTitle(text)
    setIsLoading(true)
    setLiveActivity(null)
    setLastScan(null)
    setStreamingText('')
    setStreamingThinking('')
    setApprovalRequest(null)
    setActionStatuses({})
    setPaymentGate(null)
    // Keep planSteps context visible across runs

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
          } else if (payload.event === 'tool_call') {
            pushActionHistory('tool_call', payload.data.name, payload.data.input)
            if (payload.data.name === 'browser_fill_fields' && Array.isArray(payload.data.input?.fields)) {
              setLiveActivity({
                type: 'fill',
                fields: payload.data.input.fields as FillField[],
              })
            }
          } else if (payload.event === 'tool_start') {
            pushActionHistory('tool_start', payload.data.name, null)
            setLiveActivity({
              type: 'tool',
              name: payload.data.name as string,
              status: 'active',
              data: payload.data.input,
            })
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
            pushActionHistory('tool_result', payload.data.name, payload.data.result)
            setLiveActivity(null)
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
              // (Globe visualization displayed — user can toggle to execution manually)
            }
          } else if (payload.event === 'context_gathered') {
            // Context gathered event retained for future UX hooks.
          } else if (payload.event === 'approval_request') {
            const finalText = fullText.trim()
            if (finalText) {
              setMessages((prev) => [...prev, { role: 'assistant', content: finalText, thinking: fullThinking || undefined }])
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
            // Browser action details are captured through actionHistory tool_result events.
          } else if (payload.event === 'scan_log') {
            setLastScan(payload.data as ScanSummary)
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
            const finalText = fullText.trim()
            if (finalText) {
              setMessages((prev) => [...prev, { role: 'assistant', content: finalText, thinking: fullThinking || undefined }])
              setStreamingText('')
              setStreamingThinking('')
              fullText = ''
              fullThinking = ''
            }
            setLiveActivity(null)
          } else if (payload.event === 'error') {
            const visionError = 'The vision falters. Speak again.'
            setMessages((prev) => [...prev, { role: 'assistant', content: visionError }])
            setStreamingText('')
          }
        }
      }

      const finalText = fullText.trim()
      if (finalText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: finalText, thinking: fullThinking || undefined }])
        setStreamingText('')
        setStreamingThinking('')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User paused — already handled in handlePause
        return
      }
      console.error('[sendMessage] Error:', err)
      const visionError = 'The vision falters. Speak again.'
      setMessages((prev) => [...prev, { role: 'assistant', content: visionError }])
      setStreamingText('')
    } finally {
      // Only clean up state if this is still the active run.
      // If a newer sendMessage has started, it owns isLoading/abortRef now.
      if (runIdRef.current === thisRunId) {
        abortRef.current = null
        setIsLoading(false)
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

  const canGoBackToGlobe = !isLoading
  const hasExecutionHistory = messages.length > 0 || actionHistory.length > 0 || planSteps.length > 0

  function handlePaymentChoice(choice: 'self' | 'find') {
    setPaymentGate(null)
    if (choice === 'self') {
      sendMessage("[USER_CHOICE] I'll enter payment details myself. Continue with the rest.")
      return
    }
    sendMessage('[USER_CHOICE] Find my payment info and fill it in.')
  }

  if (mode === 'execution') {
    return (
      <>
        <ExecutionPage
          missionTitle={missionTitle}
          planSteps={planSteps}
          liveActivity={liveActivity}
          lastScan={lastScan}
          actionHistory={actionHistory}
          messages={messages}
          streamingText={streamingText}
          streamingThinking={streamingThinking}
          approvalRequest={approvalRequest}
          paymentGate={paymentGate}
          actionStatuses={actionStatuses}
          isLoading={isLoading}
          tokenUsage={tokenUsage}
          input={input}
          isListening={voice.isRecording}
          voiceMode={voice.voiceMode}
          passportMissing={!hasPassportProfile}
          consultationState={consultationState}
          onInputChange={setInput}
          onSubmitMessage={sendMessage}
          onMicClick={handleOrbClick}
          onPassportClick={() => setShowPassport(true)}
          onApprove={handleApprove}
          onSkip={handleSkip}
          onApproveAll={handleApproveAll}
          onSubmitApprovals={handleSubmitApprovals}
          onBack={() => setMode('globe')}
          onToggleVoiceMode={() => {
            const next = !voice.voiceMode
            voice.setVoiceMode(next)
            if (!next) {
              voice.stopRecording()
              voice.stopPlayback()
            }
          }}
          onToggleActionMode={() => setActionMode((prev) => !prev)}
          actionMode={actionMode}
          isSpeaking={voice.isPlaying}
          onPaymentChoice={handlePaymentChoice}
        />
        {showPassport && (
          <PassportForm
            onClose={() => setShowPassport(false)}
            onSaved={(iso) => {
              setHasPassportProfile(true)
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

  return (
    <>
      {/* 3D Globe Scene — full background */}
      <OfficeScene />
      <GlobeTooltip />

      {/* Controls — top right */}
      <div className="fixed top-4 right-4 z-30 flex flex-col items-center gap-2">
        {/* Voice status label */}
        <div className="h-4">
          {voice.isRecording ? (
            <span className="text-[10px] text-red-400 tracking-widest uppercase animate-pulse">Listening...</span>
          ) : isLoading && !streamingText ? (
            <span className="text-[10px] text-[#b8956f] tracking-widest uppercase">Thinking...</span>
          ) : voice.isPlaying ? (
            <span className="text-[10px] text-purple-400 tracking-widest uppercase">Speaking...</span>
          ) : null}
        </div>

        {/* Partial STT transcript */}
        {userSpeaking && (
          <div className="px-3 py-1.5 bg-[#1a1410]/60 backdrop-blur-sm rounded-lg max-w-[200px]">
            <p className="text-[10px] text-[#d4b896] italic text-center">{userSpeaking}</p>
          </div>
        )}

        {/* Voice mode toggle */}
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
              : 'bg-[#1a1410]/40 border-[#6b5344] text-[#b8956f] hover:text-[#e8cdb5]'
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
              : 'bg-[#1a1410]/40 border-[#6b5344] text-[#b8956f] hover:text-[#e8cdb5]'
          }`}
        >
          {actionMode ? 'action mode' : 'action off'}
        </button>
      </div>

      {/* Connectors — always visible top-center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30">
        <ConnectorStatus />
      </div>

      {/* Parchment sidebars — appear after first interaction */}
      <GlobeSidebars
        messages={messages}
        streamingThinking={streamingThinking}
        streamingText={streamingText}
        actionHistory={actionHistory}
        planSteps={planSteps}
        tokenUsage={tokenUsage}
        isLoading={isLoading}
        voiceIsRecording={voice.isRecording}
        voiceIsPlaying={voice.isPlaying}
        inputValue={input}
        onInputChange={setInput}
        onSubmitMessage={sendMessage}
        onMicClick={handleOrbClick}
        isListening={voice.isRecording}
        voiceMode={voice.voiceMode}
        passportMissing={!hasPassportProfile}
        consultationState={consultationState}
        onPassportSaved={(iso) => {
          setHasPassportProfile(true)
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: `Passport updated. Globe now showing visa requirements for ${iso} passport holders.`,
          }])
        }}
      />

      {/* Open execution button — floats above left sidebar */}
      {hasExecutionHistory && (
        <div className="fixed top-4 left-[372px] z-30">
          <button
            type="button"
            onClick={() => setMode('execution')}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#6b5344] bg-[#1a1410]/40 text-[#e8cdb5] hover:text-[#faf5f0] hover:border-[#8b7355] transition-colors"
          >
            Open execution
          </button>
        </div>
      )}

      {/* Centered step-by-step approval flow */}
      {approvalRequest && (
        <ApprovalFlow
          request={approvalRequest}
          actionStatuses={actionStatuses}
          onApprove={handleApprove}
          onSkip={handleSkip}
          onSubmit={handleSubmitApprovals}
        />
      )}

      <ConsultationInput
        value={input}
        onChange={setInput}
        onSubmit={sendMessage}
        onMicClick={() => {
          // Toggle voice mode on if not active, then toggle recording
          if (!voice.voiceMode) {
            voice.setVoiceMode(true)
          }
          if (voice.isRecording) {
            voice.stopRecording()
          } else {
            voice.stopPlayback()
            voice.startRecording()
          }
        }}
        onPassportClick={() => {}}
        isListening={voice.isRecording}
        voiceMode={voice.voiceMode}
        passportMissing={false}
        consultationState={consultationState}
        variant="dark"
        hidePassport
      />
    </>
  )
}
