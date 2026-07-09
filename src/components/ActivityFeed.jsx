import { EXPLORER_TX_URL } from '../lib/config'

const TONE_DOT = {
  go: 'bg-signal-go',
  hold: 'bg-signal-hold',
  stop: 'bg-signal-stop',
  neutral: 'bg-parchment-dim/40',
}

export default function ActivityFeed({ feed, isPolling }) {
  return (
    <aside className="bg-ink-soft border border-ink-line rounded-lg p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base text-parchment">Live Activity</h3>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-parchment-dim/50">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-signal-go animate-pulse' : 'bg-parchment-dim/30'}`}
          />
          {isPolling ? 'syncing' : 'idle'}
        </span>
      </div>

      {feed.length === 0 ? (
        <p className="font-mono text-xs text-parchment-dim/40 py-6 text-center">
          No on-chain events yet. Create a job to start the ledger.
        </p>
      ) : (
        <ul className="space-y-0 max-h-[480px] overflow-y-auto">
          {feed.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2.5 py-2.5 border-b border-ink-line/60 last:border-b-0"
            >
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TONE_DOT[entry.tone] || TONE_DOT.neutral}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-parchment truncate">{entry.label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[10px] text-parchment-dim/40">
                    ledger {entry.ledger}
                  </span>
                  {entry.txHash && (
                    <a
                      href={EXPLORER_TX_URL(entry.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[10px] text-parchment-dim/40 hover:text-brass truncate"
                    >
                      {entry.txHash.slice(0, 8)}…
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
