export default function JobCardSkeleton() {
  return (
    <div className="bg-ink-soft border border-ink-line rounded-lg p-4 sm:p-5 animate-pulse">
      <div className="h-3 w-24 bg-ink-line rounded mb-3" />
      <div className="h-5 w-32 bg-ink-line rounded mb-4" />
      <div className="h-16 bg-ink-line/60 rounded" />
    </div>
  )
}
