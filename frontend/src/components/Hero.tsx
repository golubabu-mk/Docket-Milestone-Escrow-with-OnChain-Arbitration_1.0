interface HeroProps {
  openCount: number;
  totalEscrowed: string;
  paidCount: number;
}

export function Hero({ openCount, totalEscrowed, paidCount }: HeroProps) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className="grid sm:grid-cols-[1.4fr,1fr] gap-10 items-end">
          <div>
            <p className="font-mono text-xs tracking-widest text-brass uppercase mb-4">
              Posted · Claimed · Paid — nothing off-ledger
            </p>
            <h1 className="font-display text-[2.6rem] sm:text-6xl leading-[1.02] tracking-tight">
              Work gets funded.
              <br />
              <span className="italic text-ink-soft">Payment finds its way</span>
              <br />
              the moment it&apos;s earned.
            </h1>
            <p className="mt-5 max-w-md text-ink-soft leading-relaxed">
              Sponsors escrow a bounty in XLM. Contributors claim it, submit
              their work, and get paid the instant it&apos;s approved —
              every step stamped onto Stellar, every contributor building a
              reputation that travels with them.
            </p>
          </div>

          <dl className="grid grid-cols-3 sm:grid-cols-1 gap-4 sm:gap-3 sm:border-l sm:border-line sm:pl-8">
            <StatRow label="Open right now" value={openCount.toString()} accent="amber" />
            <StatRow label="Currently escrowed" value={`${totalEscrowed} XLM`} accent="brass" />
            <StatRow label="Paid out to date" value={paidCount.toString()} accent="moss" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "amber" | "brass" | "moss";
}) {
  const accentClass = {
    amber: "text-amber",
    brass: "text-brass",
    moss: "text-moss",
  }[accent];

  return (
    <div>
      <dd className={`font-mono text-2xl sm:text-3xl font-medium ${accentClass}`}>{value}</dd>
      <dt className="text-xs text-ink-soft/70 mt-1">{label}</dt>
    </div>
  );
}
