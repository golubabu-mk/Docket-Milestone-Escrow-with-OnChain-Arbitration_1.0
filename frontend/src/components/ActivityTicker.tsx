"use client";

import { ActivityEvent } from "@/lib/types";
import { formatAddress, formatRelativeTime } from "@/lib/format";
import { EXPLORER_TX_URL } from "@/lib/config";

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  BountyPosted: "POSTED",
  SubmissionMade: "CLAIMED",
  BountyDisputed: "DISPUTED",
  BountyPaid: "PAID",
  BountyCancelled: "CANCELLED",
  ReputationUpdated: "REP+",
};

const KIND_COLOR: Record<ActivityEvent["kind"], string> = {
  BountyPosted: "text-brass",
  SubmissionMade: "text-ink-soft",
  BountyDisputed: "text-rust",
  BountyPaid: "text-moss",
  BountyCancelled: "text-ink-soft/50",
  ReputationUpdated: "text-amber",
};

interface ActivityTickerProps {
  events: ActivityEvent[];
}

export function ActivityTicker({ events }: ActivityTickerProps) {
  return (
    <aside className="rounded-card border border-line bg-ledger text-paper overflow-hidden card-edge">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="font-mono text-[11px] tracking-widest uppercase text-amber">
          Live Ledger Feed
        </p>
        <span className="flex items-center gap-1.5 text-[11px] font-mono text-paper/50">
          <span className="w-1.5 h-1.5 rounded-full bg-moss status-dot" />
          streaming
        </span>
      </div>

      <div className="ledger-scroll max-h-[420px] overflow-y-auto divide-y divide-white/5">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-paper/50 font-mono">
              No activity yet this session.
            </p>
            <p className="text-xs text-paper/30 mt-1">
              Post or claim a bounty to see it land here, live.
            </p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="px-4 py-3 flex items-start gap-3 animate-stamp"
              style={{ animationDuration: "0.3s" }}
            >
              <span
                className={`font-mono text-[10px] font-semibold tracking-wider mt-0.5 w-16 flex-shrink-0 ${KIND_COLOR[event.kind]}`}
              >
                {KIND_LABEL[event.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-paper/90 truncate">{event.detail}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-paper/40">
                    {formatAddress(event.actor)}
                  </span>
                  <span className="text-[11px] text-paper/30">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                  {event.txHash && (
                    <a
                      href={EXPLORER_TX_URL(event.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-brass hover:text-amber transition-colors"
                    >
                      view tx ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
