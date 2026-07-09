"use client";

import { formatAddress } from "@/lib/format";

interface HeaderProps {
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Header({ address, balance, isConnecting, onConnect, onDisconnect }: HeaderProps) {
  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-card bg-ink flex items-center justify-center flex-shrink-0">
            <span className="font-display text-amber text-lg leading-none">B</span>
          </div>
          <div>
            <p className="font-display text-lg sm:text-xl tracking-tight leading-none">
              The Bounty Board
            </p>
            <p className="text-[11px] font-mono text-ink-soft/60 tracking-wide mt-0.5">
              STELLAR TESTNET LEDGER
            </p>
          </div>
        </div>

        {address ? (
          <div className="flex items-center gap-3">
            {balance && (
              <div className="hidden sm:block text-sm font-mono text-ink-soft">
                {parseFloat(balance).toFixed(2)} XLM
              </div>
            )}
            <button
              onClick={onDisconnect}
              className="group flex items-center gap-2 rounded-card border border-line bg-white px-3 py-2 text-sm font-mono hover:border-rust/40 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-moss status-dot" />
              <span>{formatAddress(address, 5)}</span>
              <span className="text-ink-soft/40 group-hover:text-rust transition-colors">
                · disconnect
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="rounded-card bg-ink text-paper px-4 py-2 text-sm font-medium hover:bg-ledger transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isConnecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
