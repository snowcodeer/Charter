'use client'

import { useMemo, useState } from 'react'
import type { PlanStep } from '@/components/agent/AgentTimeline'

interface PlanTrackerProps {
  steps: PlanStep[]
}

export function PlanTracker({ steps }: PlanTrackerProps) {
  const [preview, setPreview] = useState<PlanStep | null>(null)
  const completedCount = useMemo(() => steps.filter((step) => step.status === 'done').length, [steps])

  if (steps.length === 0) return null

  return (
    <>
      <aside className="rounded-xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-sm p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Plan</p>
          <p className="text-[10px] text-zinc-600">{completedCount}/{steps.length}</p>
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {steps.map((step) => (
            <div key={step.id} className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                {step.status === 'done' ? (
                  <span className="text-emerald-400 text-xs">✓</span>
                ) : step.status === 'active' ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                ) : step.status === 'error' ? (
                  <span className="text-red-400 text-xs">!</span>
                ) : (
                  <span className="text-zinc-600 text-xs">○</span>
                )}
                <p className={`text-xs ${step.status === 'active' ? 'text-zinc-100' : 'text-zinc-300'}`}>{step.title}</p>
              </div>

              <p className="text-[10px] text-zinc-600 italic leading-relaxed">{step.proof}</p>

              {step.summary && <p className="text-[10px] text-emerald-400/80">{step.summary}</p>}

              {step.screenshot && (
                <button
                  type="button"
                  onClick={() => setPreview(step)}
                  className="block w-full overflow-hidden rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <img src={step.screenshot} alt={step.title} className="w-full h-20 object-cover" />
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {preview?.screenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setPreview(null)}>
          <div className="max-w-4xl max-h-[85vh] w-full rounded-xl border border-zinc-700 overflow-hidden bg-zinc-950" onClick={(e) => e.stopPropagation()}>
            <img src={preview.screenshot} alt={preview.title} className="w-full max-h-[78vh] object-contain bg-black" />
            <div className="p-3 border-t border-zinc-800">
              <p className="text-sm text-zinc-200">{preview.title}</p>
              {preview.summary && <p className="text-xs text-emerald-400 mt-1">{preview.summary}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
