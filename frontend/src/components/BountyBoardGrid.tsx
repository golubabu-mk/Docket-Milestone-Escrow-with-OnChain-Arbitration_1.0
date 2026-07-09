import { Bounty, BountyStatus } from "@/lib/types";
import { BountyCard } from "./BountyCard";
import { BountyCardSkeleton } from "./BountyCardSkeleton";

interface BountyBoardGridProps {
  bounties: Bounty[];
  isLoading: boolean;
  error: string | null;
  currentAddress: string | null;
  onClaim: (bounty: Bounty) => void;
  onApprove: (bounty: Bounty) => void;
  onDispute: (bounty: Bounty) => void;
  busyAction: string | null;
  onRetry: () => void;
}

const COLUMNS: { status: BountyStatus; label: string; hint: string }[] = [
  { status: "Open", label: "Open", hint: "Ready to claim" },
  { status: "Submitted", label: "In review", hint: "Awaiting sponsor" },
  { status: "Disputed", label: "Disputed", hint: "Needs resolution" },
  { status: "Paid", label: "Paid", hint: "Settled on-chain" },
];

export function BountyBoardGrid(props: BountyBoardGridProps) {
  const { bounties, isLoading, error, onRetry } = props;

  if (error) {
    return (
      <div className="rounded-card border border-rust/30 bg-rust/5 px-6 py-10 text-center">
        <p className="font-display text-lg text-rust mb-1">The board couldn&apos;t load</p>
        <p className="text-sm text-ink-soft mb-4 max-w-md mx-auto">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-card bg-ink text-paper px-4 py-2 text-sm font-medium hover:bg-ledger transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {COLUMNS.map((col) => {
        const items = bounties.filter((b) => b.status === col.status);
        return (
          <div key={col.status} className="min-w-0">
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h2 className="font-display text-base">{col.label}</h2>
              <span className="text-[11px] font-mono text-ink-soft/50">
                {isLoading ? "···" : items.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {isLoading && (
                <>
                  <BountyCardSkeleton />
                  <BountyCardSkeleton />
                </>
              )}
              {!isLoading && items.length === 0 && (
                <div className="rounded-card border border-dashed border-line px-4 py-8 text-center">
                  <p className="text-xs text-ink-soft/40">{col.hint}</p>
                </div>
              )}
              {!isLoading &&
                items.map((bounty) => (
                  <BountyCard
                    key={bounty.id}
                    bounty={bounty}
                    currentAddress={props.currentAddress}
                    onClaim={props.onClaim}
                    onApprove={props.onApprove}
                    onDispute={props.onDispute}
                    busyAction={props.busyAction}
                  />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
