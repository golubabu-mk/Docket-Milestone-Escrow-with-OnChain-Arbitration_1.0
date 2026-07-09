const STAMP_STYLES = {
  Pending: { text: 'PENDING', color: 'text-parchment-dim/50 border-parchment-dim/30' },
  Submitted: { text: 'SUBMITTED', color: 'text-signal-hold border-signal-hold/60' },
  Approved: { text: 'APPROVED', color: 'text-signal-go border-signal-go/60' },
  Released: { text: 'RELEASED', color: 'text-signal-go border-signal-go/60' },
  Disputed: { text: 'DISPUTED', color: 'text-signal-stop border-signal-stop/60' },
}

export default function StampBadge({ status, size = 'md' }) {
  const style = STAMP_STYLES[status] || STAMP_STYLES.Pending
  const sizeClasses = size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'

  return (
    <span
      className={`font-mono ${sizeClasses} uppercase tracking-widest2 border-[1.5px] rounded-sm inline-block rotate-[-2deg] ${style.color}`}
      style={{ fontWeight: 600 }}
    >
      {style.text}
    </span>
  )
}
