import { Bounty } from "@/lib/types";
import { stroopsToXlm, formatAddress, formatRelativeTime } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

interface BountyCardProps {
  bounty: Bounty;
  currentAddress: string | null;
  onClaim: (bounty: Bounty) => void;
  onApprove: (bounty: Bounty) => void;
  onDispute: (bounty: Bounty) => void;
  busyAction: string | null;
}

export function BountyCard({
  bounty,
  currentAddress,
  onClaim,
  onApprove,
  onDispute,
  busyAction,
}: BountyCardProps) {
  const isSponsor = currentAddress === bounty.sponsor;
  const isContributor = currentAddress === bounty.contributor;
  const isBusy = (action: string) => busyAction === `${bounty.id}-${action}`;

  return (
    <article className="rounded-card border border-line bg-white p-4 card-edge flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-snug">{bounty.title}</h3>
        <StatusBadge status={bounty.status} />
      </div>

      <p className="text-sm text-ink-soft leading-relaxed line-clamp-3">
        {bounty.description}
      </p>

      <div className="flex items-baseline justify-between mt-1">
        <span className="font-mono text-xl text-brass font-medium">
          {stroopsToXlm(bounty.reward)} <span className="text-xs text-brass/60">XLM</span>
        </span>
        <span className="text-[11px] font-mono text-ink-soft/50">
          #{bounty.id.toString().padStart(3, "0")}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-soft/60 border-t border-line pt-3">
        <span>
          Sponsor <span className="font-mono">{formatAddress(bounty.sponsor)}</span>
        </span>
        <span>{formatRelativeTime(bounty.createdAt)}</span>
      </div>

      {bounty.contributor && (
        <p className="text-xs text-ink-soft/60 -mt-2">
          Claimed by <span className="font-mono">{formatAddress(bounty.contributor)}</span>
        </p>
      )}

      {bounty.submissionNote && (
        <div className="bg-paper rounded-card border border-line px-3 py-2 -mt-1">
          <p className="text-[11px] font-mono text-ink-soft/50 uppercase tracking-wide mb-1">
            Submission note
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">{bounty.submissionNote}</p>
        </div>
      )}

      <div className="flex gap-2 mt-1">
        {bounty.status === "Open" && !isSponsor && currentAddress && (
          <ActionButton
            label="Claim this bounty"
            variant="primary"
            busy={isBusy("claim")}
            onClick={() => onClaim(bounty)}
          />
        )}
        {bounty.status === "Open" && !currentAddress && (
          <p className="text-xs text-ink-soft/50 italic">Connect a wallet to claim this.</p>
        )}
        {bounty.status === "Submitted" && isSponsor && (
          <>
            <ActionButton
              label="Approve & pay"
              variant="primary"
              busy={isBusy("approve")}
              onClick={() => onApprove(bounty)}
            />
            <ActionButton
              label="Dispute"
              variant="ghost-danger"
              busy={isBusy("dispute")}
              onClick={() => onDispute(bounty)}
            />
          </>
        )}
        {bounty.status === "Submitted" && isContributor && (
          <p className="text-xs text-ink-soft/50 italic">
            Waiting on the sponsor to review your submission.
          </p>
        )}
        {bounty.status === "Disputed" && isSponsor && (
          <ActionButton
            label="Approve & pay anyway"
            variant="primary"
            busy={isBusy("approve")}
            onClick={() => onApprove(bounty)}
          />
        )}
      </div>
    </article>
  );
}

function ActionButton({
  label,
  variant,
  busy,
  onClick,
}: {
  label: string;
  variant: "primary" | "ghost-danger";
  busy: boolean;
  onClick: () => void;
}) {
  const base =
    "flex-1 rounded-card px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-wait";
  const styles =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-ledger"
      : "border border-rust/30 text-rust hover:bg-rust/5";

  return (
    <button className={`${base} ${styles}`} disabled={busy} onClick={onClick}>
      {busy ? "Confirming…" : label}
    </button>
  );
}
