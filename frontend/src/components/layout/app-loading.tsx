import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton of the app shell, shown while the session and workspace load. */
export function AppLoadingScreen({ label = "Loading workspace…" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-svh bg-background">
      <div className="hidden w-[252px] shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 3 }).map((_, group) => (
          <div key={group} className="space-y-2.5 px-1">
            <Skeleton className="h-2 w-14" />
            {Array.from({ length: 4 }).map((__, item) => (
              <div key={item} className="flex items-center gap-2.5">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <Skeleton className="h-3 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="size-8" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1200px] space-y-6 p-8">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
