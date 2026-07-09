import { useState } from 'react'
import { TOKEN_CONTRACT_ID } from '../lib/config'

const emptyMilestone = () => ({ description: '', amount: '' })

export default function CreateJobForm({ onCreate, disabled }) {
  const [freelancer, setFreelancer] = useState('')
  const [token, setToken] = useState(TOKEN_CONTRACT_ID)
  const [milestones, setMilestones] = useState([emptyMilestone(), emptyMilestone()])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const updateMilestone = (idx, field, value) => {
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))
  }

  const addMilestone = () => setMilestones((prev) => [...prev, emptyMilestone()])
  const removeMilestone = (idx) =>
    setMilestones((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))

  const total = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

  const valid =
    freelancer.trim().length > 0 &&
    token.trim().length > 0 &&
    milestones.every((m) => m.description.trim() && Number(m.amount) > 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      await onCreate({
        freelancer: freelancer.trim(),
        token: token.trim(),
        descriptions: milestones.map((m) => m.description.trim()),
        amounts: milestones.map((m) => Number(m.amount)),
      })
      setFreelancer('')
      setToken(TOKEN_CONTRACT_ID)
      setMilestones([emptyMilestone(), emptyMilestone()])
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full py-4 border-2 border-dashed border-ink-line rounded-lg text-parchment-dim/60 hover:border-brass/50 hover:text-brass transition-colors font-mono text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Open a new job docket
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-ink-soft border border-brass/30 rounded-lg p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-parchment">New Job Docket</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-xs text-parchment-dim/50 hover:text-parchment"
        >
          cancel
        </button>
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest2 text-parchment-dim/60 block mb-1.5">
          Freelancer address
        </label>
        <input
          value={freelancer}
          onChange={(e) => setFreelancer(e.target.value)}
          placeholder="G..."
          className="w-full bg-ink border border-ink-line rounded p-2.5 text-sm font-mono text-parchment placeholder:text-parchment-dim/30 focus:border-brass/60 outline-none"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest2 text-parchment-dim/60 block mb-1.5">
          Payment token contract
        </label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="C..."
          className="w-full bg-ink border border-ink-line rounded p-2.5 text-sm font-mono text-parchment placeholder:text-parchment-dim/30 focus:border-brass/60 outline-none"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest2 text-parchment-dim/60 block mb-2">
          Milestones
        </label>
        <div className="space-y-2">
          {milestones.map((m, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                value={m.description}
                onChange={(e) => updateMilestone(idx, 'description', e.target.value)}
                placeholder={`Milestone ${idx + 1} description`}
                className="flex-1 min-w-0 bg-ink border border-ink-line rounded p-2 text-sm text-parchment placeholder:text-parchment-dim/30 focus:border-brass/60 outline-none"
              />
              <input
                value={m.amount}
                onChange={(e) => updateMilestone(idx, 'amount', e.target.value)}
                placeholder="Amount"
                type="number"
                min="0"
                className="w-24 sm:w-28 bg-ink border border-ink-line rounded p-2 text-sm font-mono text-parchment placeholder:text-parchment-dim/30 focus:border-brass/60 outline-none"
              />
              {milestones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMilestone(idx)}
                  className="text-parchment-dim/40 hover:text-signal-stop px-1"
                  aria-label="Remove milestone"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addMilestone}
          className="mt-2 font-mono text-xs text-brass hover:text-brass-bright"
        >
          + add milestone
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-ink-line">
        <p className="font-mono text-xs text-parchment-dim/60">
          Total to fund: <span className="text-brass">{total || 0}</span>
        </p>
        <button
          type="submit"
          disabled={!valid || busy || disabled}
          className="font-mono text-sm px-4 py-2 rounded bg-brass text-ink font-medium hover:bg-brass-bright disabled:opacity-40 transition-colors"
        >
          {busy ? 'Funding…' : 'Create & fund job'}
        </button>
      </div>
    </form>
  )
}
