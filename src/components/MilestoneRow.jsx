import StampBadge from './StampBadge'

export default function MilestoneRow({
  milestone,
  index,
  isClient,
  isFreelancer,
  onSubmit,
  onApprove,
  busy,
}) {
  const canSubmit = isFreelancer && milestone.status === 'Pending'
  const canApprove = isClient && milestone.status === 'Submitted'

  return (
    <div className="flex items-center justify-between gap-3 py-3 px-1 border-b border-ink-line/70 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-parchment truncate">{milestone.description}</p>
        <p className="font-mono text-xs text-parchment-dim/60 mt-0.5">
          #{index.toString().padStart(2, '0')} · {milestone.amount} XLM
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StampBadge status={milestone.status} size="sm" />

        {canSubmit && (
          <button
            onClick={() => onSubmit(index)}
            disabled={busy}
            className="font-mono text-[11px] px-2.5 py-1.5 rounded border border-brass/50 text-brass hover:bg-brass/10 disabled:opacity-40 transition-colors"
          >
            Mark done
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => onApprove(index)}
            disabled={busy}
            className="font-mono text-[11px] px-2.5 py-1.5 rounded bg-signal-go text-ink font-medium hover:brightness-110 disabled:opacity-40 transition-colors"
          >
            Approve &amp; pay
          </button>
        )}
      </div>
    </div>
  )
}
