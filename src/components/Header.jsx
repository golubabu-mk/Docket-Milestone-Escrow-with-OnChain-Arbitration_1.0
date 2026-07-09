export default function Header({ wallet }) {
  const short = (addr) => (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '')

  return (
    <header className="border-b border-ink-line bg-ink/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full border-2 border-brass flex items-center justify-center rotate-[-3deg]">
            <span className="font-display text-brass text-sm leading-none">D</span>
          </div>
          <div>
            <h1 className="font-display text-lg sm:text-xl tracking-tight text-parchment leading-none">
              Docket
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest2 text-parchment-dim/60 leading-none mt-1">
              Milestone Escrow · Soroban
            </p>
          </div>
        </div>

        <div>
          {wallet.address ? (
            <button
              onClick={wallet.disconnect}
              className="font-mono text-xs sm:text-sm px-3 py-2 rounded border border-brass/40 text-brass hover:bg-brass/10 transition-colors flex items-center gap-3"
              title="Click to disconnect"
            >
              {wallet.balance && (
                <span className="text-parchment-dim border-r border-brass/40 pr-3">
                  {(Number(wallet.balance) / 10000000).toFixed(2)} XLM
                </span>
              )}
              <span>{short(wallet.address)}</span>
            </button>
          ) : (
            <button
              onClick={wallet.connect}
              disabled={wallet.connecting}
              className="font-mono text-xs sm:text-sm px-3 sm:px-4 py-2 rounded bg-brass text-ink font-medium hover:bg-brass-bright transition-colors disabled:opacity-50"
            >
              {wallet.connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
      {!wallet.installed && (
        <div className="bg-signal-stop/10 border-t border-signal-stop/30 text-signal-stop text-xs sm:text-sm text-center py-2 px-4">
          Freighter wallet extension not detected —{' '}
          <a href="https://freighter.app" target="_blank" rel="noreferrer" className="underline">
            install it
          </a>{' '}
          to interact with contracts.
        </div>
      )}
    </header>
  )
}
