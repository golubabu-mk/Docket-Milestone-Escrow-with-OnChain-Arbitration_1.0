export default function Hero() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 sm:pb-10">
      <p className="font-mono text-[11px] uppercase tracking-widest2 text-brass mb-4">
        A ledger, not a vault
      </p>
      <h2 className="font-display text-3xl sm:text-5xl leading-[1.05] text-parchment max-w-2xl">
        Freelance work,{' '}
        <span className="italic text-brass">paid milestone by milestone</span>
        — and arbitrated on-chain when it isn&apos;t.
      </h2>
      <p className="mt-5 text-parchment-dim/80 max-w-xl text-sm sm:text-base leading-relaxed">
        A client funds a job up front. Each milestone releases its own slice
        of payment the moment it&apos;s approved. If either side disagrees, a
        separate Arbiter contract — not a support ticket, not a chargeback —
        settles it, and the ruling is enforced automatically.
      </p>
    </section>
  )
}
