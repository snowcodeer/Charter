'use client'

import { useMemo } from 'react'
import type { ApprovalRequest } from '@/components/agent/ApprovalCard'

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  visa: '🛂',
  accommodation: '🏨',
  calendar: '📅',
  insurance: '🛡️',
  transport: '🚕',
  document: '📄',
  other: '⚙️',
}

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-900/40', text: 'text-green-400' },
  medium: { bg: 'bg-amber-900/40', text: 'text-amber-400' },
  high: { bg: 'bg-red-900/40', text: 'text-red-400' },
}

const TAG = 'text-[11px] px-2 py-0.5 rounded-full border'

interface ApprovalFlowProps {
  request: ApprovalRequest
  actionStatuses: Record<string, 'pending' | 'approved' | 'skipped'>
  onApprove: (id: string) => void
  onSkip: (id: string) => void
  onSubmit: () => void
}

function ActionCard({
  action,
  status,
  onApprove,
  onSkip,
}: {
  action: import('@/components/agent/ApprovalCard').ActionItem
  status: 'pending' | 'approved' | 'skipped'
  onApprove: (id: string) => void
  onSkip: (id: string) => void
}) {
  const icon = TYPE_ICONS[action.type] || TYPE_ICONS.other
  const isRecommended = action.recommended
  const isDecided = status !== 'pending'
  const risk = RISK_COLORS[action.risk]

  return (
    <div
      className={`relative flex flex-col rounded-2xl border transition-all duration-300 backdrop-blur-xl overflow-hidden ${
        isDecided
          ? status === 'approved'
            ? 'border-green-700/50 bg-card/20 opacity-60 scale-[0.97]'
            : 'border-border/30 bg-card/10 opacity-40 scale-[0.97]'
          : isRecommended
          ? 'border-primary/60 bg-background/80 scale-[1.02] shadow-[0_0_30px_rgba(166,124,82,0.2)]'
          : 'border-border bg-background/80'
      }`}
    >
      {/* Recommended banner */}
      {isRecommended && status === 'pending' && (
        <div className="bg-gradient-to-r from-primary to-chart-4 text-[10px] font-semibold text-primary-foreground text-center py-1 tracking-wide uppercase font-[var(--font-sans)]">
          Recommended
        </div>
      )}

      {/* Decided overlay */}
      {isDecided && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className={`text-sm font-medium px-3 py-1 rounded-full font-[var(--font-sans)] ${
            status === 'approved' ? 'bg-green-900/80 text-green-300' : 'bg-muted/80 text-muted-foreground'
          }`}>
            {status === 'approved' ? 'Approved' : 'Skipped'}
          </span>
        </div>
      )}

      <div className={`p-4 flex flex-col flex-1 gap-3 ${isDecided ? 'blur-[1px]' : ''}`}>
        {/* Row 1: Icon + Title */}
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{icon}</span>
          <div className="min-w-0">
            <h4 className="text-[13px] font-semibold text-foreground leading-tight truncate font-[var(--font-sans)]">{action.title}</h4>
            {action.provider && (
              <span className="text-[11px] text-muted-foreground">{action.provider}</span>
            )}
          </div>
        </div>

        {/* Row 2: Price hero (if available) */}
        {action.price && (
          <div className="text-2xl font-bold text-foreground tracking-tight font-[var(--font-serif)]">{action.price}</div>
        )}

        {/* Row 3: Tags */}
        <div className="flex flex-wrap gap-1.5">
          {action.duration && (
            <span className={`${TAG} bg-muted border-border text-primary`}>
              {action.duration}
            </span>
          )}
          <span className={`${TAG} ${risk.bg} border-transparent ${risk.text}`}>
            {action.risk} risk
          </span>
          {action.url && (
            <a
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${TAG} bg-muted/50 border-border/50 text-blue-400/80 hover:text-blue-300 transition-colors`}
            >
              {(() => { try { return new URL(action.url).hostname.replace('www.', '') } catch { return 'link' } })()}
            </a>
          )}
        </div>

        {/* Buttons */}
        {status === 'pending' && (
          <div className="flex gap-2 mt-auto pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => onSkip(action.id)}
              className="flex-1 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors font-[var(--font-sans)]"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onApprove(action.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors font-[var(--font-sans)] ${
                isRecommended
                  ? 'bg-primary text-primary-foreground hover:bg-chart-4'
                  : 'bg-primary text-primary-foreground hover:bg-chart-4'
              }`}
            >
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Group actions by type, preserving order of first appearance.
 * Same-type actions (e.g. 3 flight options) become one group shown side-by-side.
 * Different types become single-item groups shown sequentially.
 */
function groupByType(actions: import('@/components/agent/ApprovalCard').ActionItem[]) {
  const groups: import('@/components/agent/ApprovalCard').ActionItem[][] = []
  const seen = new Map<string, number>()
  for (const action of actions) {
    const idx = seen.get(action.type)
    if (idx !== undefined) {
      groups[idx].push(action)
    } else {
      seen.set(action.type, groups.length)
      groups.push([action])
    }
  }
  return groups
}

export function ApprovalFlow({
  request,
  actionStatuses,
  onApprove,
  onSkip,
  onSubmit,
}: ApprovalFlowProps) {
  const groups = useMemo(() => groupByType(request.actions), [request.actions])

  const { decided, total, allDecided, hasApproved } = useMemo(() => {
    const total = request.actions.length
    const decided = request.actions.filter(a => actionStatuses[a.id] !== 'pending').length
    return { decided, total, allDecided: decided === total, hasApproved: request.actions.some(a => actionStatuses[a.id] === 'approved') }
  }, [request.actions, actionStatuses])

  const activeGroupIndex = useMemo(() => {
    return groups.findIndex(group => group.some(a => actionStatuses[a.id] === 'pending'))
  }, [groups, actionStatuses])

  const currentGroup = activeGroupIndex >= 0 ? groups[activeGroupIndex] : null
  const isComparison = currentGroup && currentGroup.length > 1

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className={`pointer-events-auto mx-4 ${isComparison ? 'w-full max-w-3xl' : 'w-full max-w-sm'}`}>
        <div className="bg-background/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground font-[var(--font-sans)]">
                {allDecided ? 'Action Plan' : `Step ${Math.min(activeGroupIndex + 1, groups.length)} of ${groups.length}`}
              </h3>
              <span className="text-xs text-muted-foreground">
                {decided}/{total} decided
              </span>
            </div>
            {request.summary && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{request.summary}</p>
            )}
            <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(decided / total) * 100}%` }}
              />
            </div>
          </div>

          {allDecided ? (
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                {request.actions.map((a) => {
                  const s = actionStatuses[a.id]
                  const icon = TYPE_ICONS[a.type] || TYPE_ICONS.other
                  return (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span>{icon}</span>
                      <span className={`font-[var(--font-sans)] ${s === 'approved' ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                        {a.title}
                      </span>
                      {a.price && s === 'approved' && (
                        <span className="text-xs text-primary ml-auto">{a.price}</span>
                      )}
                      <span className={`text-[10px] ${!a.price || s !== 'approved' ? 'ml-auto' : ''} ${s === 'approved' ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {s === 'approved' ? 'Approved' : 'Skipped'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {hasApproved ? (
                <button
                  type="button"
                  onClick={onSubmit}
                  className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors font-[var(--font-sans)]"
                >
                  Execute Approved Actions
                </button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">All actions skipped</p>
              )}
            </div>
          ) : currentGroup && (
            <div className="p-4">
              {isComparison && (
                <p className="text-[11px] text-muted-foreground mb-3 text-center uppercase tracking-wider font-[var(--font-sans)]">
                  Compare {currentGroup[0].type} options
                </p>
              )}
              <div className={`grid gap-3 ${
                currentGroup.length === 1
                  ? 'grid-cols-1'
                  : currentGroup.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}>
                {currentGroup.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    status={actionStatuses[action.id] || 'pending'}
                    onApprove={onApprove}
                    onSkip={onSkip}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
