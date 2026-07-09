"use client";

import { useEffect, useState } from "react";
import { ContributorStats } from "@/lib/types";
import { getContributorStats } from "@/lib/soroban";
import { stroopsToXlm } from "@/lib/format";

const TIER_COLOR: Record<ContributorStats["tier"], string> = {
  New: "text-ink-soft/60",
  Trusted: "text-brass",
  Veteran: "text-moss",
  Elite: "text-amber",
};

export function ReputationPanel({ address }: { address: string }) {
  const [stats, setStats] = useState<ContributorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getContributorStats(address)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your reputation right now.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="rounded-card border border-line bg-white p-4 card-edge">
      <p className="font-mono text-[11px] tracking-widest uppercase text-ink-soft/50 mb-3">
        Your reputation
      </p>

      {isLoading && (
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-line/50 rounded w-1/2" />
          <div className="h-3 bg-line/30 rounded w-3/4" />
        </div>
      )}

      {error && <p className="text-sm text-rust">{error}</p>}

      {stats && !isLoading && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={`font-display text-2xl ${TIER_COLOR[stats.tier]}`}>{stats.tier}</p>
            <p className="text-[11px] text-ink-soft/50">
              score {stats.reputationScore}/1000
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg">{stats.completedBounties}</p>
            <p className="text-[11px] text-ink-soft/50">bounties completed</p>
          </div>
          <div>
            <p className="font-mono text-lg text-brass">
              {stroopsToXlm(stats.totalEarned)} <span className="text-xs">XLM</span>
            </p>
            <p className="text-[11px] text-ink-soft/50">total earned</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg text-rust/70">{stats.disputesLost}</p>
            <p className="text-[11px] text-ink-soft/50">disputes lost</p>
          </div>
        </div>
      )}
    </div>
  );
}
