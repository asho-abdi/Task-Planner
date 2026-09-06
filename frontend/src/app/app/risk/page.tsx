"use client";

import { useState } from "react";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightRow, PageControls, StatCard } from "@/features/insights/ui";
import { useRisk } from "@/features/insights/hooks";
import { localDateYmd } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function RiskPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const date = localDateYmd();
  const risk = useRisk(workspaceId, { date, page, pageSize });
  const total = risk.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      <PageHeader
        title="Risk"
        description="Deterministic score from overdue work, deadlines, dependencies, assignee overload, and priority."
      />

      {risk.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : risk.isError ? (
        <p className="text-sm text-destructive">{risk.error.message}</p>
      ) : !risk.data ? (
        <EmptyState title="Unable to load risk" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Overdue" value={risk.data.summary.overdueCount} />
            <StatCard label="Blocked" value={risk.data.summary.blockedCount} />
            <StatCard
              label="Overloaded people"
              value={risk.data.summary.overloadedAssignees}
            />
            <StatCard
              label="Avg score"
              value={risk.data.summary.averageScore}
            />
          </div>
          {risk.data.items.length === 0 ? (
            <EmptyState title="No at-risk tasks" />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
              {risk.data.items.map((item) => (
                <InsightRow
                  key={item.id}
                  href={`/app/tasks/${item.id}`}
                  title={item.title}
                  meta={`${item.project?.name ?? "No project"} · ${item.assignee?.name ?? "Unassigned"}${item.blocked ? " · Blocked" : ""}`}
                  aside={item.level}
                />
              ))}
            </div>
          )}
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
