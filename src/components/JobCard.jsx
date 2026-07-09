import { useState } from 'react'
import MilestoneRow from './MilestoneRow'
import { EXPLORER_TX_URL } from '../lib/config'

const JOB_STATUS_LABEL = {
  Active: 'Active',
  Disputed: 'In Dispute',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
}

export default function JobCard({ job, walletAddress, onSubmitMilestone, onApproveMilestone, onRaiseDispute, onSettleDispute, lastTxHash }) {
  const [disputeReason, setDisputeReason] = useState('')
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const isClient = walletAddress && job.client === walletAddress
  const isFreelancer = walletAddress && job.freelancer === walletAddress
  const canDispute = (isClient || isFreelancer) && job.status === 'Active'

  const short = (addr) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—')

  const wrap = (fn) => async (...args) => {
    setBusy(true)
    try {
      await fn(...args)
    } finally {
      setBusy(false)
    }
  }

  const handleDisputeSubmit = wrap(async () => {
    if (!disputeReason.trim()) return
    await onRaiseDispute(job.id, disputeReason.trim())
    setShowDisputeForm(false)
    setDisputeReason('')
  })

  return (
    <article className="relative bg-ink-soft border border-ink-line rounded-lg shadow-stamp overflow-hidden">
      <div className="ledger-rule absolute inset-0 pointer-events-none opacity-40" />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest2 text-parchment-dim/50">
              Docket No. {String(job.id).padStart(4, '0')}
            </p>
            <h3 className="font-display text-lg text-parchment mt-0.5">
              {JOB_STATUS_LABEL[job.status] || job.status}
            </h3>
          </div>
          <div
            className={`px-2.5 py-1 rounded-sm border text-[10px] font-mono uppercase tracking-widest2 rotate-[-2deg] ${
              job.status === 'Disputed'
                ? 'border-signal-stop/60 text-signal-stop'
                : job.status === 'Completed'
                ? 'border-signal-go/60 text-signal-go'
                : 'border-brass/50 text-brass'
            }`}
          >
            {job.status}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
          <div>
            <p className="text-parchment-dim/50 uppercase tracking-wide text-[10px] mb-0.5">Client</p>
            <p className="text-parchment-dim">{short(job.client)}</p>
          </div>
          <div>
            <p className="text-parchment-dim/50 uppercase tracking-wide text-[10px] mb-0.5">Freelancer</p>
            <p className="text-parchment-dim">{short(job.freelancer)}</p>
          </div>
        </div>

        <div className="bg-ink/40 rounded border border-ink-line">
          {job.milestones.map((m, idx) => (
            <MilestoneRow
              key={idx}
              milestone={m}
              index={idx}
              isClient={isClient}
              isFreelancer={isFreelancer}
              busy={busy}
              onSubmit={wrap((i) => onSubmitMilestone(job.id, i))}
              onApprove={wrap((i) => onApproveMilestone(job.id, i))}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-line/70">
          <p className="font-mono text-xs text-parchment-dim/60">
            Total funded:{' '}
            <span className="text-brass">{job.fundedAmount} XLM</span>
          </p>

          {job.status === 'Active' && canDispute && !showDisputeForm && (
            <button
              onClick={() => setShowDisputeForm(true)}
              className="font-mono text-[11px] px-2.5 py-1.5 rounded border border-signal-stop/50 text-signal-stop hover:bg-signal-stop/10 transition-colors"
            >
              Raise dispute
            </button>
          )}

          {job.status === 'Disputed' && (
            <button
              onClick={wrap(() => onSettleDispute(job.id))}
              disabled={busy}
              className="font-mono text-[11px] px-2.5 py-1.5 rounded border border-signal-hold/50 text-signal-hold hover:bg-signal-hold/10 disabled:opacity-40 transition-colors"
            >
              Check ruling &amp; settle
            </button>
          )}
        </div>

        {showDisputeForm && (
          <div className="mt-3 p-3 bg-signal-stop/5 border border-signal-stop/30 rounded">
            <label className="font-mono text-[10px] uppercase tracking-widest2 text-signal-stop block mb-2">
              Reason for dispute
            </label>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={2}
              className="w-full bg-ink border border-ink-line rounded p-2 text-sm text-parchment placeholder:text-parchment-dim/40 focus:border-signal-stop/60 outline-none resize-none"
              placeholder="Describe what went wrong…"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleDisputeSubmit}
                disabled={busy || !disputeReason.trim()}
                className="font-mono text-[11px] px-3 py-1.5 rounded bg-signal-stop text-parchment font-medium disabled:opacity-40"
              >
                File with arbiter
              </button>
              <button
                onClick={() => setShowDisputeForm(false)}
                className="font-mono text-[11px] px-3 py-1.5 rounded border border-ink-line text-parchment-dim"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {lastTxHash && (
          <a
            href={EXPLORER_TX_URL(lastTxHash)}
            target="_blank"
            rel="noreferrer"
            className="block mt-3 font-mono text-[10px] text-parchment-dim/40 hover:text-brass truncate transition-colors"
          >
            last tx: {lastTxHash}
          </a>
        )}
      </div>
    </article>
  )
}
