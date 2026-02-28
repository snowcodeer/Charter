'use client'

export interface ActionItem {
  id: string
  type: 'flight' | 'visa' | 'accommodation' | 'calendar' | 'insurance' | 'transport' | 'document' | 'other'
  title: string
  description: string
  risk: 'low' | 'medium' | 'high'
  url?: string
}

export interface ApprovalRequest {
  summary: string
  actions: ActionItem[]
}

const TYPE_ICONS: Record<string, string> = {
  flight: '\u2708\uFE0F',
  visa: '\uD83D\uDEC2',
  accommodation: '\uD83C\uDFE8',
  calendar: '\uD83D\uDCC5',
  insurance: '\uD83D\uDEE1\uFE0F',
  transport: '\uD83D\uDE95',
  document: '\uD83D\uDCC4',
  other: '\u2699\uFE0F',
}

const RISK_COLORS: Record<string, string> = {
  low: 'border-green-800 bg-green-950/20',
  medium: 'border-amber-800 bg-amber-950/20',
  high: 'border-red-800 bg-red-950/20',
}

const RISK_BADGE: Record<string, string> = {
  low: 'bg-green-900/50 text-green-400',
  medium: 'bg-amber-900/50 text-amber-400',
  high: 'bg-red-900/50 text-red-400',
}

export function ApprovalCard({
  action,
  onApprove,
  onSkip,
  status,
}: {
  action: ActionItem
  onApprove: (id: string) => void
  onSkip: (id: string) => void
  status: 'pending' | 'approved' | 'skipped'
}) {
  const icon = TYPE_ICONS[action.type] || TYPE_ICONS.other

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      status === 'approved'
        ? 'border-green-700 bg-green-950/30 opacity-80'
        : status === 'skipped'
        ? 'border-zinc-800 bg-zinc-950/30 opacity-50'
        : RISK_COLORS[action.risk]
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-white">{action.title}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RISK_BADGE[action.risk]}`}>
              {action.risk}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{action.description}</p>
          {action.url && (
            <a
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:underline mt-1 block truncate"
            >
              {action.url}
            </a>
          )}
        </div>
      </div>

      {status === 'pending' && (
        <div className="flex gap-2 mt-3 ml-8">
          <button
            onClick={() => onApprove(action.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onSkip(action.id)}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            Skip
          </button>
        </div>
      )}

      {status === 'approved' && (
        <div className="text-[10px] text-green-400 mt-2 ml-8">Approved</div>
      )}
      {status === 'skipped' && (
        <div className="text-[10px] text-zinc-500 mt-2 ml-8">Skipped</div>
      )}
    </div>
  )
}

export function ApprovalCardList({
  request,
  actionStatuses,
  onApprove,
  onSkip,
  onApproveAll,
  onSubmit,
}: {
  request: ApprovalRequest
  actionStatuses: Record<string, 'pending' | 'approved' | 'skipped'>
  onApprove: (id: string) => void
  onSkip: (id: string) => void
  onApproveAll: () => void
  onSubmit: () => void
}) {
  const hasPending = request.actions.some((a) => actionStatuses[a.id] === 'pending')
  const hasApproved = request.actions.some((a) => actionStatuses[a.id] === 'approved')

  return (
    <div className="flex justify-start px-4 pb-4">
      <div className="max-w-[85%] space-y-3">
        {request.summary && (
          <p className="text-sm text-zinc-300 leading-relaxed">{request.summary}</p>
        )}

        <div className="space-y-2">
          {request.actions.map((action) => (
            <ApprovalCard
              key={action.id}
              action={action}
              onApprove={onApprove}
              onSkip={onSkip}
              status={actionStatuses[action.id] || 'pending'}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {hasPending && (
            <button
              onClick={onApproveAll}
              className="text-xs px-4 py-2 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors"
            >
              Approve All
            </button>
          )}
          {hasApproved && !hasPending && (
            <button
              onClick={onSubmit}
              className="text-xs px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
            >
              Execute Approved Actions
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
