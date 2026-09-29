"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Gauge,
  ListTodo,
  Users,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  StatCard,
} from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Meter, PageControls, utilizationTone } from "@/features/insights/ui";
import { useWorkload } from "@/features/insights/hooks";
import { cn, localDateYmd } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const TONE_TEXT = {
  success: "text-success-soft-foreground",
  warning: "text-warning-soft-foreground",
  danger: "text-danger-soft-foreground",
} as const;

const TONE_LABEL = {
  success: "Available",
  warning: "Near capacity",
  danger: "Overloaded",
} as const;

function WorkloadSkeleton() {
  return (
    <div role="status" aria-label="Loading workload" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <ListPanel>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-4 sm:px-5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2 w-full max-w-md rounded-full" />
              </div>
              <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
      </ListPanel>
    </div>
  );
}

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
        icon={Gauge}
        title="Team Workload"
        description="Capacity uses task priority, estimated time, due dates, and status."
      />

      {workload.isLoading ? (
        <WorkloadSkeleton />
      ) : workload.isError ? (
        <ErrorState
          title="Couldn't load workload"
          description={workload.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void workload.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !workload.data ? (
        <EmptyState icon={Gauge} title="Unable to load workload" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Members"
              value={workload.data.total}
              icon={Users}
              tone="primary"
            />
            <StatCard
              label="Overloaded"
              value={workload.data.overloadedCount}
              icon={AlertTriangle}
              tone={workload.data.overloadedCount > 0 ? "danger" : "success"}
              hint={workload.data.overloadedCount > 0 ? "Above daily capacity" : "Everyone within capacity"}
            />
            <StatCard
              label="Capacity / day"
              value={`${workload.data.hoursPerDay}h`}
              icon={Clock}
              tone="info"
              hint="Per member"
            />
          </div>

          {workload.data.users.length === 0 ? (
            <ListPanel>
              <EmptyState
                icon={Users}
                title="No members to show"
                description="Workload appears once people are assigned open tasks."
              />
            </ListPanel>
          ) : (
            <ListPanel>
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)] gap-6 border-b border-border bg-muted/60 px-5 py-2 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground md:grid">
                <span>Member</span>
                <span>Today vs capacity</span>
                <span className="text-right">Open work</span>
              </div>
              <ul className="divide-y divide-border">
                {workload.data.users.map((user) => {
                  const rawPercent = Math.round(user.utilization * 100);
                  const percent = Math.min(100, rawPercent);
                  const tone = utilizationTone(rawPercent, user.overloaded) as keyof typeof TONE_TEXT;
                  return (
                    <li key={user.userId} className="px-4 py-4 sm:px-5">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)] md:items-center md:gap-6">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={user.name} title={user.name} />
                          <div className="min-w-0">
                            <p className="truncate text-base font-medium text-foreground">
                              {user.name}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-muted-foreground tabular">
                              <span className="font-medium text-foreground">{user.todayHours}h</span>{" "}
                              / {user.capacityHours}h
                            </span>
                            <span className={cn("font-medium tabular", TONE_TEXT[tone])}>
                              {rawPercent}%
                            </span>
                          </div>
                          <Meter
                            value={percent}
                            tone={tone}
                            className="h-2"
                            label={`${user.name} utilisation ${rawPercent}%`}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground md:justify-end">
                          <span className="inline-flex items-center gap-1.5 tabular" title="Open tasks">
                            <ListTodo className="size-3.5" />
                            {user.openTaskCount} open
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular" title="Deadlines this week">
                            <CalendarClock className="size-3.5" />
                            {user.weekDeadlineCount ?? 0} this week
                          </span>
                          <Badge variant={tone} dot>
                            {TONE_LABEL[tone]}
                          </Badge>
                        </div>
                      </div>

                      {user.unestimatedCount > 0 ? (
                        <p className="mt-2 text-xs text-subtle-foreground md:pl-12">
                          {user.unestimatedCount} task{user.unestimatedCount === 1 ? "" : "s"} without an estimate
                        </p>
                      ) : null}

                      {user.warning ? (
                        <div className="mt-3 flex gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground md:ml-12">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                          <div>
                            <p className="font-medium">{user.warning.title}</p>
                            <p className="mt-0.5 opacity-90">{user.warning.message}</p>
                          </div>
                        </div>
                      ) : null}
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
