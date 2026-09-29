"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  AlertOctagon,
  Ban,
  CalendarX,
  Flame,
  FolderKanban,
  Gauge,
  Link2,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  StatCard,
} from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageControls } from "@/features/insights/ui";
import { useRisk } from "@/features/insights/hooks";
import type { RiskLevel, RiskTask } from "@/features/insights/types";
import { cn, formatDate, localDateYmd } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const LEVEL_META: Record<RiskLevel, { label: string; variant: BadgeVariant; bar: string }> = {
  CRITICAL: { label: "Critical", variant: "danger", bar: "bg-danger" },
  HIGH: { label: "High", variant: "danger", bar: "bg-danger" },
  MEDIUM: { label: "Medium", variant: "warning", bar: "bg-warning" },
  LOW: { label: "Low", variant: "default", bar: "bg-subtle-foreground" },
};

function reasonsFor(item: RiskTask) {
  const reasons: Array<{ key: string; label: string; icon: typeof Flame; points?: number }> = [];
  if (item.factors.overdue > 0)
    reasons.push({ key: "overdue", label: "Overdue", icon: CalendarX, points: item.factors.overdue });
  if (item.factors.deadline > 0)
    reasons.push({ key: "deadline", label: "Deadline soon", icon: AlarmClock, points: item.factors.deadline });
  if (item.blocked || item.factors.dependency > 0)
    reasons.push({
      key: "dependency",
      label: item.blocked ? "Blocked" : "Dependencies",
      icon: item.blocked ? Ban : Link2,
      points: item.factors.dependency || undefined,
    });
  if (item.factors.workload > 0)
    reasons.push({ key: "workload", label: "Owner overloaded", icon: UserX, points: item.factors.workload });
  if (item.factors.priority > 0)
    reasons.push({ key: "priority", label: "High priority", icon: Flame, points: item.factors.priority });
  return reasons;
}

function RiskSkeleton() {
  return (
    <div role="status" aria-label="Loading risk" className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <ListPanel>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/5" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
              <Skeleton className="hidden size-7 rounded-full sm:block" />
            </div>
          ))}
        </div>
      </ListPanel>
    </div>
  );
}

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
        icon={ShieldAlert}
        title="Risk"
        description="Deterministic score from overdue work, deadlines, dependencies, assignee overload, and priority."
      />

      {risk.isLoading ? (
        <RiskSkeleton />
      ) : risk.isError ? (
        <ErrorState
          title="Couldn't load risk"
          description={risk.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void risk.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !risk.data ? (
        <EmptyState icon={ShieldAlert} title="Unable to load risk" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard
              label="Critical / high"
              value={risk.data.summary.criticalCount + risk.data.summary.highCount}
              icon={AlertOctagon}
              tone={
                risk.data.summary.criticalCount + risk.data.summary.highCount > 0
                  ? "danger"
                  : "success"
              }
              className="col-span-2 lg:col-span-1"
            />
            <StatCard
              label="Overdue"
              value={risk.data.summary.overdueCount}
              icon={CalendarX}
              tone={risk.data.summary.overdueCount > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Blocked"
              value={risk.data.summary.blockedCount}
              icon={Ban}
              tone={risk.data.summary.blockedCount > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Overloaded people"
              value={risk.data.summary.overloadedAssignees}
              icon={UserX}
              tone={risk.data.summary.overloadedAssignees > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Avg score"
              value={risk.data.summary.averageScore}
              icon={Gauge}
            />
          </div>

          {risk.data.items.length === 0 ? (
            <ListPanel>
              <EmptyState
                icon={ShieldCheck}
                title="No risks detected"
                description="Nothing is overdue, blocked, or at risk right now."
                className="[&>div:first-child]:border-success/25 [&>div:first-child]:bg-success-soft [&>div:first-child]:text-success-soft-foreground"
              />
            </ListPanel>
          ) : (
            <ListPanel>
              <ul className="divide-y divide-border">
                {risk.data.items.map((item) => {
                  const meta = LEVEL_META[item.level] ?? LEVEL_META.LOW;
                  const reasons = reasonsFor(item);
                  const overdue =
                    item.factors.overdue > 0 ||
                    Boolean(item.dueDate && item.dueDate.slice(0, 10) < date);
                  return (
                    <li key={item.id} className="relative">
                      <span
                        aria-hidden
                        className={cn("absolute inset-y-0 left-0 w-0.5", meta.bar)}
                      />
                      <Link
                        href={`/app/tasks/${item.id}`}
                        className="flex flex-col gap-3 px-4 py-4 transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={meta.variant}
                              dot
                              className={cn(item.level === "CRITICAL" && "ring-1 ring-danger/40")}
                            >
                              {meta.label}
                            </Badge>
                            <p className="min-w-0 truncate text-base font-medium text-foreground">
                              {item.title}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <FolderKanban className="size-3.5" />
                              {item.project?.name ?? "No project"}
                            </span>
                            {reasons.map((reason) => {
                              const Icon = reason.icon;
                              return (
                                <span
                                  key={reason.key}
                                  title={reason.points ? `+${reason.points} risk points` : undefined}
                                  className="inline-flex h-5 items-center gap-1 rounded-full border border-border bg-muted/60 px-2 text-2xs font-medium text-muted-foreground"
                                >
                                  <Icon className="size-3" />
                                  {reason.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div className="flex items-center gap-2" title={item.assignee?.name ?? "Unassigned"}>
                            {item.assignee ? (
                              <Avatar name={item.assignee.name} size="sm" />
                            ) : (
                              <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-border-strong text-muted-foreground">
                                <UserX className="size-3" />
                              </span>
                            )}
                            <span className="max-w-32 truncate text-sm text-muted-foreground">
                              {item.assignee?.name ?? "Unassigned"}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "w-24 text-sm tabular sm:text-right",
                              item.dueDate
                                ? overdue
                                  ? "font-medium text-danger-soft-foreground"
                                  : "text-muted-foreground"
                                : "text-subtle-foreground",
                            )}
                          >
                            {item.dueDate ? formatDate(item.dueDate) : "No due date"}
                          </span>
                          <span
                            className="flex w-12 flex-col items-end"
                            title={`Risk score ${item.score}`}
                          >
                            <span className="text-sm font-semibold text-foreground tabular">
                              {item.score}
                            </span>
                            <span className="text-2xs text-subtle-foreground">score</span>
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </ListPanel>
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
