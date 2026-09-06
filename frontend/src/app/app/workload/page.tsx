"use client";

import { useState } from "react";
import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";
import { Meter, PageControls, StatCard, workloadGlyph } from "@/features/insights/ui";
import { useWorkload } from "@/features/insights/hooks";
import { localDateYmd } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function WorkloadPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const date = localDateYmd();
  const workload = useWorkload(workspaceId, { date, page, pageSize });
  const total = workload.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      <PageHeader
        title="Team Workload"
        description="Capacity uses task priority, estimated time, due dates, and status."
      />

      {workload.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : workload.isError ? (
        <p className="text-sm text-destructive">{workload.error.message}</p>
      ) : !workload.data ? (
        <EmptyState title="Unable to load workload" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Members" value={workload.data.total} />
            <StatCard
              label="Overloaded"
              value={workload.data.overloadedCount}
            />
            <StatCard
              label="Capacity / day"
              value={`${workload.data.hoursPerDay}h`}
            />
          </div>
          <div className="space-y-3">
            {workload.data.users.map((user) => {
              const percent = Math.min(100, Math.round(user.utilization * 100));
              return (
                <Surface key={user.userId}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {workloadGlyph(percent)} {percent}%
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {user.openTaskCount} open · {user.weekDeadlineCount ?? 0}{" "}
                        deadlines this week
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {user.todayHours}h / {user.capacityHours}h
                      </p>
                      {user.overloaded ? <StatusBadge value="URGENT" /> : null}
                    </div>
                  </div>
                  <Meter value={percent} danger={user.overloaded} />
                  {user.warning ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <p className="font-medium">{user.warning.title}</p>
                      <p className="mt-0.5">{user.warning.message}</p>
                    </div>
                  ) : null}
                </Surface>
              );
            })}
          </div>
          <PageControls
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </>
      )}
    </PageShell>
  );
}
