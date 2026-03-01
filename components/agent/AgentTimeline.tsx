'use client'

import { useState, useEffect, useRef } from 'react'

export interface PlanStep {
  id: string
  title: string
  proof: string
  status: 'pending' | 'active' | 'done' | 'error'
  summary?: string
  screenshot?: string
}

interface AgentTimelineProps {
  steps: PlanStep[]
  visible: boolean
}

export function AgentTimeline({ steps, visible }: AgentTimelineProps) {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)
  const [previewStep, setPreviewStep] = useState<PlanStep | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const activeEl = containerRef.current.querySelector('[data-active="true"]')
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [steps])

  const completedCount = steps.filter(s => s.status === 'done').length

  if (steps.length === 0) return null

  return (
    <>
      {/* Timeline strip */}
      <div
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-[#1a1410]/90 border border-[#4a3728]/60 rounded px-4 py-3 max-w-sm w-max">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-[#b8956f] uppercase tracking-widest font-medium">Plan</span>
            <span className="text-[10px] text-[#8b7355]">{completedCount}/{steps.length}</span>
          </div>

          <div ref={containerRef} className="space-y-1 max-h-40 overflow-y-auto">
            {steps.map((step) => (
              <div
                key={step.id}
                data-active={step.status === 'active' ? 'true' : undefined}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded cursor-default ${
                  step.status === 'done' && step.screenshot ? 'cursor-pointer hover:bg-[#4a3728]/50' : ''
                }`}
                onMouseEnter={() => {
                  setHoveredStep(step.id)
                  if (step.status === 'done' && step.screenshot) setPreviewStep(step)
                }}
                onMouseLeave={() => {
                  setHoveredStep(null)
                  setPreviewStep(null)
                }}
              >
                <div className="flex-shrink-0">
                  {step.status === 'done' ? (
                    <div className="w-4 h-4 rounded-full bg-[#6b8f71]/20 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4 7L8 3" stroke="#6b8f71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ) : step.status === 'active' ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#8b6f47] border-t-transparent animate-spin" />
                  ) : step.status === 'error' ? (
                    <div className="w-4 h-4 rounded-full bg-[#9e4a3a]/20 flex items-center justify-center">
                      <span className="text-[#9e4a3a] text-[8px] font-bold">!</span>
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#6b5344]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`text-xs truncate ${
                    step.status === 'done' ? 'text-[#d4b896]' :
                    step.status === 'active' ? 'text-[#faf5f0]' :
                    'text-[#8b7355]'
                  }`}>
                    {step.title}
                  </p>
                  {step.status === 'done' && step.summary && hoveredStep === step.id && (
                    <p className="text-[10px] text-[#6b8f71]/70 truncate mt-0.5">{step.summary}</p>
                  )}
                </div>

                {step.status === 'done' && step.screenshot && (
                  <div className="flex-shrink-0 w-5 h-5 rounded border border-[#6b5344] overflow-hidden">
                    <img src={step.screenshot} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full screenshot preview overlay */}
      {previewStep?.screenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[#1a1410]/80 absolute inset-0 animate-[fadeIn_0.15s_ease-out]" />
          <div className="relative z-10 max-w-3xl max-h-[80vh] rounded overflow-hidden border border-[#6b5344] shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <img src={previewStep.screenshot} alt={previewStep.summary || previewStep.title} className="w-full h-full object-contain" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a1410]/90 to-transparent p-4">
              <p className="text-sm text-[#faf5f0] font-medium">{previewStep.title}</p>
              {previewStep.summary && <p className="text-xs text-[#6b8f71] mt-1">{previewStep.summary}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
