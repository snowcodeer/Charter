'use client'

import type { FillField } from '@/components/agent/executionTypes'

interface FormFillCardProps {
  fields: FillField[]
}

function confidenceDots(confidence: FillField['confidence']): number {
  if (confidence === 'high') return 4
  if (confidence === 'medium') return 3
  return 2
}

export function FormFillCard({ fields }: FormFillCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-4 animate-[slide-up_240ms_ease-out]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-zinc-200 font-medium">Filling visa application</h3>
        <span className="text-xs text-zinc-500">{fields.length} fields</span>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {fields.map((field, index) => (
          <div
            key={`${field.label}-${index}`}
            className="grid grid-cols-[minmax(120px,1fr)_minmax(130px,1fr)_auto_auto] gap-2 items-center text-xs rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2 opacity-0 animate-[slide-up_220ms_ease-out_forwards]"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="text-zinc-400 truncate">{field.label}</span>
            <span className="text-zinc-200 truncate">{field.value || '-'}</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 4 }).map((_, dotIdx) => {
                const active = dotIdx < confidenceDots(field.confidence)
                const color = field.confidence === 'high' ? 'bg-emerald-400' : field.confidence === 'medium' ? 'bg-amber-400' : 'bg-red-400'
                return (
                  <span
                    key={dotIdx}
                    className={`inline-block h-1.5 w-1.5 rounded-full ${active ? color : 'bg-zinc-700'}`}
                  />
                )
              })}
            </div>
            <span className="text-[10px] text-zinc-500 rounded border border-zinc-800 px-1.5 py-0.5 truncate max-w-[110px]">
              {field.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
