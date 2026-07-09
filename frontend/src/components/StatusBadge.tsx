import { BountyStatus } from "@/lib/types";

const STYLES: Record<BountyStatus, string> = {
  Open: "bg-white text-ink-soft border-line",
  Submitted: "bg-brass/10 text-brass border-brass/30",
  Disputed: "bg-rust/10 text-rust border-rust/30",
  Paid: "bg-moss/10 text-moss border-moss/30",
  Cancelled: "bg-ink-soft/5 text-ink-soft/40 border-line",
};

export function StatusBadge({ status }: { status: BountyStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono tracking-wide uppercase ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
