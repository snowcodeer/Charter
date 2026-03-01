'use client'

import { useMemo, useState } from 'react'
import { type ApprovalRequest, ApprovalCardList } from '@/components/agent/ApprovalCard'
import { ConsultationInput } from '@/components/agent/ConsultationInput'
import { ConnectorStatus } from '@/components/agent/ConnectorStatus'
import { LiveActivity } from '@/components/agent/LiveActivity'
import { MessageHistory } from '@/components/agent/MessageHistory'
import { PlanTracker } from '@/components/agent/PlanTracker'
import { ReasoningDrawer } from '@/components/agent/ReasoningDrawer'
import { SiriOrb } from '@/components/agent/SiriOrb'
import { formatAgentOutput } from '@/components/agent/formatAgentOutput'
import type { PlanStep } from '@/components/agent/AgentTimeline'
import type { ChatMessage } from '@/components/agent/ChatMessages'
import type { ActionHistoryItem, LiveActivityState, ScanSummary } from '@/components/agent/executionTypes'
import type { ConsultationState } from '@/lib/hooks/useConsultationState'

interface TokenUsage {
  input: number
  output: number
  total: number
  limit: number
}

interface PaymentGate {
  message: string
  url: string
}

export interface ExecutionPageProps {
  missionTitle: string
  planSteps: PlanStep[]
  liveActivity: LiveActivityState | null
  lastScan: ScanSummary | null
  actionHistory: ActionHistoryItem[]
  streamingText: string
  streamingThinking: string
  messages: ChatMessage[]
  approvalRequest: ApprovalRequest | null
  paymentGate: PaymentGate | null
  actionStatuses: Record<string, 'pending' | 'approved' | 'skipped'>
  isLoading: boolean
  tokenUsage: TokenUsage | null
  input: string
  isListening: boolean
  voiceMode: boolean
  passportMissing: boolean
  consultationState: ConsultationState
  onInputChange: (value: string) => void
  onSubmitMessage: (value: string) => void
  onMicClick: () => void
  onPassportClick: () => void
  onApprove: (id: string) => void
  onSkip: (id: string) => void
  onApproveAll: () => void
  onSubmitApprovals: () => void
  onBack: () => void
  onToggleVoiceMode: () => void
  onToggleActionMode: () => void
  actionMode: boolean
  isSpeaking: boolean
  onPaymentChoice: (choice: 'self' | 'find') => void
}

function prettyToolName(name: string): string {
  return name.replaceAll('_', ' ')
}

export function ExecutionPage(props: ExecutionPageProps) {
  const {
    missionTitle,
    planSteps,
    liveActivity,
    lastScan,
    actionHistory,
    streamingText,
    streamingThinking,
    messages,
    approvalRequest,
    paymentGate,
    actionStatuses,
    isLoading,
    tokenUsage,
    input,
    isListening,
    voiceMode,
    passportMissing,
    consultationState,
    onInputChange,
    onSubmitMessage,
    onMicClick,
    onPassportClick,
    onApprove,
    onSkip,
    onApproveAll,
    onSubmitApprovals,
    onBack,
    onToggleVoiceMode,
    onToggleActionMode,
    actionMode,
    isSpeaking,
    onPaymentChoice,
  } = props

  const [reasoningOpen, setReasoningOpen] = useState(false)
  const completedSteps = useMemo(
    () => actionHistory.filter((item) => item.type === 'tool_result').slice(-10),
    [actionHistory]
  )
  const latestAssistantText = useMemo(() => {
    if (streamingText.trim()) return formatAgentOutput(streamingText)
    const latest = [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim())
    return latest ? formatAgentOutput(latest.content) : ''
  }, [messages, streamingText])

  return (
    <div className="fixed inset-0 z-40 bg-[#1a1410] text-[#faf5f0] animate-[slide-up_260ms_ease-out]">
      <header className="h-14 border-b border-[#4a3728] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack} className="text-xs text-[#d4b896] hover:text-[#f5e6c3]">
            ← Charter
          </button>
          <div className="truncate">
            <p className="text-sm text-[#faf5f0] truncate">{missionTitle || 'Agent execution'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block"><ConnectorStatus /></div>
          <button type="button" onClick={() => setReasoningOpen(true)} className="text-xs text-[#d4b896] hover:text-[#f5e6c3]">
            View reasoning
          </button>
          <SiriOrb
            size={40}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isThinking={isLoading && !streamingText}
            onClick={onMicClick}
          />
          <button
            type="button"
            onClick={onToggleVoiceMode}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              voiceMode
                ? 'bg-purple-600/20 border-purple-600 text-purple-400'
                : 'bg-[#2a1f18] border-[#6b5344] text-[#b8956f] hover:text-[#e8cdb5]'
            }`}
          >
            {voiceMode ? 'voice on' : 'voice off'}
          </button>
          <button
            type="button"
            onClick={onToggleActionMode}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              actionMode
                ? 'bg-red-600/20 border-red-600 text-red-400'
                : 'bg-[#2a1f18] border-[#6b5344] text-[#b8956f] hover:text-[#e8cdb5]'
            }`}
          >
            {actionMode ? 'action mode' : 'action off'}
          </button>
        </div>
      </header>

      <main className="h-[calc(100%-56px)] pb-[120px] flex gap-4 p-4">
        <section className="flex-1 min-w-0 overflow-y-auto space-y-4 pr-1">
          {completedSteps.length > 0 && (
            <div className="rounded-xl border border-[#4a3728] bg-[#2a1f18]/40 p-3">
              <p className="text-[10px] uppercase tracking-widest text-[#b8956f] mb-2">Completed</p>
              <div className="flex flex-wrap gap-1.5">
                {completedSteps.map((item) => (
                  <span key={item.id} className="text-[10px] px-2 py-1 rounded-full border border-[#6b5344] text-[#e8cdb5]">
                    {prettyToolName(item.name)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <LiveActivity
            liveActivity={liveActivity}
            lastScan={lastScan}
            streamingText={streamingText}
            isLoading={isLoading}
          />

          {latestAssistantText && (
            <section className="rounded-xl border border-[#4a3728] bg-[#2a1f18]/35 p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-[#b8956f]">Latest response</p>
              <p className="text-sm text-[#faf5f0] leading-relaxed whitespace-pre-wrap">{latestAssistantText}</p>
            </section>
          )}

          <MessageHistory messages={messages} />

          {approvalRequest && (
            <div className="rounded-xl border border-[#4a3728] bg-[#2a1f18]/40 p-3">
              <ApprovalCardList
                request={approvalRequest}
                actionStatuses={actionStatuses}
                onApprove={onApprove}
                onSkip={onSkip}
                onApproveAll={onApproveAll}
                onSubmit={onSubmitApprovals}
              />
            </div>
          )}

          {paymentGate && (
            <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 space-y-3">
              <h4 className="text-sm text-amber-200">Payment Page Detected</h4>
              <p className="text-xs text-amber-300/80">{paymentGate.message}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onPaymentChoice('self')}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium"
                >
                  I&apos;ll enter payment
                </button>
                <button
                  type="button"
                  onClick={() => onPaymentChoice('find')}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-700 text-amber-300"
                >
                  Find my payment info
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="w-[300px] shrink-0 hidden lg:block">
          <PlanTracker steps={planSteps} />
        </section>
      </main>

      {tokenUsage && (
        <div className="fixed bottom-20 left-4 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2a1f18]/80 backdrop-blur-sm border border-[#4a3728]/60">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: tokenUsage.total / tokenUsage.limit < 0.5
                ? '#4ade80' : tokenUsage.total / tokenUsage.limit < 0.8
                ? '#facc15' : '#f87171',
            }}
          />
          <span className="text-[10px] font-mono text-[#d4b896]">
            {(tokenUsage.total / 1000).toFixed(1)}k
            <span className="text-[#6b5344]"> / </span>
            {(tokenUsage.limit / 1000).toFixed(0)}k
          </span>
        </div>
      )}

      <ConsultationInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmitMessage}
        onMicClick={onMicClick}
        onPassportClick={onPassportClick}
        isListening={isListening}
        voiceMode={voiceMode}
        passportMissing={passportMissing}
        consultationState={consultationState}
      />

      <ReasoningDrawer
        open={reasoningOpen}
        text={streamingThinking}
        isLoading={isLoading}
        actionHistory={actionHistory}
        onClose={() => setReasoningOpen(false)}
      />
    </div>
  )
}
