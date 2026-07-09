export function BountyCardSkeleton() {
  return (
    <div className="rounded-card border border-line bg-white p-4 animate-pulse">
      <div className="h-5 bg-line/60 rounded w-3/4 mb-3" />
      <div className="h-3 bg-line/40 rounded w-full mb-2" />
      <div className="h-3 bg-line/40 rounded w-5/6 mb-4" />
      <div className="h-6 bg-line/50 rounded w-24 mb-3" />
      <div className="h-3 bg-line/30 rounded w-1/2" />
    </div>
  );
}
