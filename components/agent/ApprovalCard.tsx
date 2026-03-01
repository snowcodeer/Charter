'use client'

export interface ActionItem {
  id: string
  type: 'flight' | 'visa' | 'accommodation' | 'calendar' | 'insurance' | 'transport' | 'document' | 'other'
  title: string
  description: string
  risk: 'low' | 'medium' | 'high'
  url?: string
  price?: string
  duration?: string
  recommended?: boolean
  provider?: string
  compareGroup?: string
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
  low: 'border-[#6b8f71]/60 bg-[#6b8f71]/15',
  medium: 'border-[#8b6f47]/60 bg-[#8b6f47]/15',
  high: 'border-[#9e4a3a]/60 bg-[#9e4a3a]/15',
}

const RISK_BADGE: Record<string, string> = {
  low: 'bg-[#6b8f71]/30 text-[#6b8f71]',
  medium: 'bg-[#8b6f47]/30 text-[#8b6f47]',
  high: 'bg-[#9e4a3a]/30 text-[#9e4a3a]',
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
    <div className={`rounded border p-3 ${
      status === 'approved'
        ? 'border-[#6b8f71]/50 bg-[#6b8f71]/15 opacity-80'
        : status === 'skipped'
        ? 'border-[#4a3728] bg-[#1a1410]/30 opacity-50'
        : RISK_COLORS[action.risk]
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-[#faf5f0]">{action.title}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${RISK_BADGE[action.risk]}`}>
              {action.risk}
            </span>
          </div>
          <p className="text-xs text-[#d4b896] mt-1 leading-relaxed">{action.description}</p>
          {action.url && (
            <a
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#8b6f47] hover:underline mt-1 block truncate"
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
            className="rustic-btn text-xs px-3 py-1.5 bg-[#f5e6c3] text-[#1a1410] font-medium hover:bg-[#faf5f0]"
          >
            Approve
          </button>
          <button
            onClick={() => onSkip(action.id)}
            className="text-xs px-3 py-1.5 rounded border border-[#6b5344] text-[#d4b896] hover:text-[#e8cdb5] hover:border-[#8b7355]"
          >
            Continue
          </button>
        </div>
      )}

      {status === 'approved' && (
        <div className="text-[10px] text-[#6b8f71] mt-2 ml-8">Approved</div>
      )}
      {status === 'skipped' && (
        <div className="text-[10px] text-[#b8956f] mt-2 ml-8">Skipped</div>
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
          <p className="text-sm text-[#e8cdb5] leading-relaxed">{request.summary}</p>
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
              className="rustic-btn text-xs px-4 py-2 bg-[#f5e6c3] text-[#1a1410] font-medium hover:bg-[#faf5f0]"
            >
              Approve All
            </button>
          )}
          {hasApproved && !hasPending && (
            <button
              onClick={onSubmit}
              className="rustic-btn text-xs px-4 py-2 bg-[#8b6f47] text-[#faf6ef] font-medium hover:bg-[#a08050]"
            >
              Execute Approved Actions
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
