'use client'

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
  low: { bg: 'bg-[#6b8f71]/15', text: 'text-[#6b8f71]' },
  medium: { bg: 'bg-[#8b6f47]/15', text: 'text-[#8b6f47]' },
  high: { bg: 'bg-[#9e4a3a]/15', text: 'text-[#9e4a3a]' },
}

const TAG = 'text-[11px] px-2 py-0.5 rounded-sm border'

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
  hideSkip,
}: {
  action: import('@/components/agent/ApprovalCard').ActionItem
  status: 'pending' | 'approved' | 'skipped'
  onApprove: (id: string) => void
  onSkip: (id: string) => void
  hideSkip?: boolean
}) {
  const icon = TYPE_ICONS[action.type] || TYPE_ICONS.other
  const isRecommended = action.recommended
  const isDecided = status !== 'pending'
  const risk = RISK_COLORS[action.risk]

  return (
    <div
      className={`relative flex flex-col rounded border overflow-hidden ${
        isDecided
          ? status === 'approved'
            ? 'border-[#6b8f71]/50 bg-card/20 opacity-60'
            : 'border-border/30 bg-card/10 opacity-40'
          : isRecommended
          ? 'border-primary/60 bg-background/80 shadow-[0_0_30px_rgba(139,111,71,0.2)]'
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
          <span className={`text-sm font-medium px-3 py-1 rounded-sm font-[var(--font-sans)] ${
            status === 'approved' ? 'bg-[#6b8f71]/60 text-[#faf6ef]' : 'bg-muted/80 text-muted-foreground'
          }`}>
            {status === 'approved' ? 'Selected' : 'Skipped'}
          </span>
        </div>
      )}

      <div className={`p-4 flex flex-col flex-1 gap-3`}>
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
              className={`${TAG} bg-muted/50 border-border/50 text-[#8b6f47] hover:text-[#a08050]`}
            >
              {(() => { try { return new URL(action.url).hostname.replace('www.', '') } catch { return 'link' } })()}
            </a>
          )}
        </div>

        {/* Buttons */}
        {status === 'pending' && (
          <div className={`flex gap-2 mt-auto pt-2 border-t border-border/40`}>
            {!hideSkip && (
              <button
                type="button"
                onClick={() => onSkip(action.id)}
                className="flex-1 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 font-[var(--font-sans)]"
              >
                Continue
              </button>
            )}
            <button
              type="button"
              onClick={() => onApprove(action.id)}
              className={`flex-1 py-2 rounded text-xs font-medium font-[var(--font-sans)] bg-primary text-primary-foreground hover:bg-chart-4`}
            >
              Select
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
 */
function groupByCompare(actions: import('@/components/agent/ApprovalCard').ActionItem[]) {
  const groups: import('@/components/agent/ApprovalCard').ActionItem[][] = []
  const seen = new Map<string, number>()
  for (const action of actions) {
    const key = action.compareGroup
    if (key) {
      const idx = seen.get(key)
      if (idx !== undefined) {
        groups[idx].push(action)
      } else {
        seen.set(key, groups.length)
        groups.push([action])
      }
    } else {
      // No compareGroup → always its own step
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
  const groups = groupByCompare(request.actions)
  const total = request.actions.length
  const decided = request.actions.filter(a => actionStatuses[a.id] !== 'pending').length
  const allDecided = decided === total
  const hasApproved = request.actions.some(a => actionStatuses[a.id] === 'approved')

  const activeGroupIndex = groups.findIndex(group => group.some(a => actionStatuses[a.id] === 'pending'))
  const currentGroup = activeGroupIndex >= 0 ? groups[activeGroupIndex] : null
  const isComparison = currentGroup != null && currentGroup.length > 1

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#1a1410]/70" />
      <div className={`relative pointer-events-auto mx-4 ${isComparison ? 'w-full max-w-3xl' : 'w-full max-w-sm'}`}>
        <div className="bg-background/80 brass-panel rounded overflow-hidden">
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
            <div className="mt-3 h-1 rounded-sm bg-muted overflow-hidden">
              <div
                className="h-full rounded-sm bg-primary"
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
                      <span className={`text-[10px] ${!a.price || s !== 'approved' ? 'ml-auto' : ''} ${s === 'approved' ? 'text-[#6b8f71]' : 'text-muted-foreground'}`}>
                        {s === 'approved' ? 'Selected' : 'Skipped'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {hasApproved ? (
                <button
                  type="button"
                  onClick={onSubmit}
                  className="rustic-btn w-full py-2.5 bg-[#8b6f47] text-[#faf6ef] text-sm font-medium hover:bg-[#a08050] font-[var(--font-sans)]"
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
                  Compare {currentGroup[0].type} options — select one
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
                    hideSkip={isComparison}
                  />
                ))}
              </div>
              {isComparison && currentGroup.some(a => actionStatuses[a.id] === 'pending') && (
                <button
                  type="button"
                  onClick={() => currentGroup.forEach(a => { if (actionStatuses[a.id] === 'pending') onSkip(a.id) })}
                  className="w-full mt-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 font-[var(--font-sans)]"
                >
                  Continue
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
