export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      {/* Header skeleton mirrors PageHeader */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface px-5 py-3.5 md:px-6">
        <div className="h-5 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3.5 w-72 animate-pulse rounded bg-muted/70" />
      </div>

      <div className="space-y-5 p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-4 shadow-card"
            >
              <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
              <div className="mt-3 h-6 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-28 animate-pulse rounded bg-muted/60" />
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-2 w-2 animate-pulse rounded-full bg-muted" />
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted/80" />
                <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-muted/60" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
