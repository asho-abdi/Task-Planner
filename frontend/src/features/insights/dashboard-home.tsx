"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  Flag,
  PieChart,
  Plus,
  Sun,
  TrendingUp,
} from "lucide-react";
import {
  PageHeader,
  PageShell,
  StatCard,
  Surface,
} from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useDashboard, useMyDay, useReports } from "@/features/insights/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import { useStartTask } from "@/features/tasks/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { activityHref } from "@/features/chat/types";
import {
  cn,
  formatDate,
  formatRelativeTime,
  formatTime,
  localDateYmd,
  nativeSelectClass,
} from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  DashboardResponse,
  DashboardTask,
  InsightTask,
} from "@/features/insights/types";

const STATUS_TONES: Record<string, string> = {
  COMPLETED: "var(--success)",
  IN_PROGRESS: "var(--chart-1)",
  OVERDUE: "var(--danger)",
  TODO: "var(--chart-6)",
  IN_REVIEW: "var(--chart-3)",
  RETURNED: "var(--warning)",
};

function firstNameOf(name?: string | null) {
  return name?.split(" ")[0] ?? "there";
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
}

function shiftYmd(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateYmd(date);
}

function weekday(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function canStartTask(status: string) {
  return status === "TODO" || status === "RETURNED" || status === "OVERDUE";
}

function isOverdue(task: InsightTask) {
  if (task.status === "OVERDUE") return true;
  if (!task.dueDate || task.status === "COMPLETED") return false;
  return task.dueDate.slice(0, 10) < localDateYmd();
}

/** Signed percent change between the first and second half of a series. */
function changeFromTrend(values: number[]): number | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const previous = values.slice(0, mid).reduce((sum, n) => sum + n, 0);
  const current = values.slice(mid).reduce((sum, n) => sum + n, 0);
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent === 0 ? null : percent;
}

export function DashboardHome() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const user = useCurrentUser();
  const workspace = useCurrentWorkspace();
  const dashboard = useDashboard(workspaceId);
  const myDay = useMyDay(workspaceId, localDateYmd());
  const [range, setRange] = useState<"7" | "14">("7");
  const to = localDateYmd();
  const from = shiftYmd(to, 1 - Number(range));
  const reports = useReports(workspaceId, { from, to });
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const openMeetingCreate = useUiStore((state) => state.openMeetingCreate);
  const firstName = firstNameOf(user.data?.name);
  const canWrite = Boolean(workspace && workspace.role !== "VIEWER");
  const data = dashboard.data;
  const todayTasks = myDay.data?.todayTasks.items ?? data?.myDay?.items ?? [];
  const now = new Date();

  const myTasks = data?.totals.myTasks ?? data?.totals.total ?? 0;
  const completed = data?.totals.completed ?? 0;
  const overdue = data?.totals.overdue ?? 0;
  const meetings =
    data?.totals.upcomingMeetings ?? data?.upcomingMeetings.total ?? 0;
  const createdTrend = reports.data?.trends.map((item) => item.created) ?? [];
  const completedTrend =
    reports.data?.trends.map((item) => item.completed) ?? [];
  const weekCreated = createdTrend.reduce((sum, n) => sum + n, 0);
  const weekCompleted = completedTrend.reduce((sum, n) => sum + n, 0);

  const donut = useMemo(() => {
    const byStatus = reports.data?.completion.byStatus ?? {};
    const rows = Object.entries(byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        label: status.replaceAll("_", " ").toLowerCase(),
        count,
        color: STATUS_TONES[status] ?? "var(--chart-6)",
      }));
    if (rows.length) return rows;
    return [
      { label: "open", count: myTasks, color: "var(--chart-1)" },
      { label: "completed", count: completed, color: "var(--success)" },
      { label: "overdue", count: overdue, color: "var(--danger)" },
    ].filter((item) => item.count > 0);
  }, [reports.data?.completion.byStatus, myTasks, completed, overdue]);
  const donutTotal = donut.reduce((sum, item) => sum + item.count, 0);

  const rangeLabel = range === "7" ? "last 7 days" : "last 14 days";

  return (
    <PageShell width="wide">
      <PageHeader
        title={`${greetingFor(now)}, ${firstName}`}
        description={
          <span>
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {workspace?.name ? (
              <span className="text-subtle-foreground">
                {" "}
                · {workspace.name}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <label className="sr-only" htmlFor="dashboard-range">
              Date range
            </label>
            <select
              id="dashboard-range"
              value={range}
              onChange={(event) => setRange(event.target.value as "7" | "14")}
              className={cn(nativeSelectClass, "h-8 w-auto min-w-32 text-sm")}
            >
              <option value="7">This week</option>
              <option value="14">Last 14 days</option>
            </select>
            {canWrite ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openMeetingCreate()}
                >
                  <CalendarPlus />
                  Schedule meeting
                </Button>
                <Button size="sm" onClick={() => openTaskCreate()}>
                  <Plus />
                  Create task
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {dashboard.isError ? (
        <ErrorState
          title="Couldn't load the dashboard"
          description={dashboard.error.message}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void dashboard.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {dashboard.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <StatSkeleton key={index} />
          ))
        ) : (
          <>
            <StatCard
              href="/app/tasks"
              label="My tasks"
              value={myTasks.toLocaleString()}
              hint="Open work assigned to you"
              icon={CheckSquare}
              tone="primary"
              delta={changeFromTrend(createdTrend)}
            />
            <StatCard
              href="/app/tasks"
              label="Completed"
              value={completed.toLocaleString()}
              hint="Finished in this workspace"
              icon={CheckCircle2}
              tone="success"
              delta={changeFromTrend(completedTrend)}
            />
            <StatCard
              href="/app/my-day"
              label="Overdue"
              value={overdue.toLocaleString()}
              hint={overdue > 0 ? "Needs attention" : "Nothing late"}
              icon={AlertTriangle}
              tone={overdue > 0 ? "danger" : "default"}
            />
            <StatCard
              href="/app/meetings"
              label="Upcoming meetings"
              value={meetings.toLocaleString()}
              hint="Scheduled this week"
              icon={CalendarDays}
              tone="info"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Surface className="flex flex-col lg:col-span-2">
          <CardHeading
            icon={TrendingUp}
            title="Activity"
            description={`Tasks created and completed, ${rangeLabel}`}
          />
          {reports.isLoading ? (
            <div className="mt-5 space-y-4">
              <div className="flex gap-6">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
              <Skeleton className="h-52 w-full" />
            </div>
          ) : reports.isError ? (
            <ErrorState
              className="mt-5"
              title="Couldn't load activity"
              description={reports.error.message}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void reports.refetch()}
                >
                  Retry
                </Button>
              }
            />
          ) : !(reports.data?.trends.length ?? 0) ? (
            <EmptyState
              compact
              icon={TrendingUp}
              title="No activity in this range yet"
              description="Created and completed tasks will be charted here."
            />
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                <LegendStat
                  swatch="var(--chart-1)"
                  label="Created"
                  value={weekCreated}
                />
                <LegendStat
                  swatch="var(--success)"
                  label="Completed"
                  value={weekCompleted}
                />
              </div>
              <TrendChart
                labels={(reports.data?.trends ?? []).map((item) =>
                  weekday(item.day),
                )}
                created={createdTrend}
                completed={completedTrend}
              />
            </>
          )}
        </Surface>

        <Surface className="flex flex-col">
          <CardHeading
            icon={PieChart}
            title="Work mix"
            description="By status in this range"
          />
          {reports.isLoading && dashboard.isLoading ? (
            <div className="mt-5 flex flex-col items-center gap-5">
              <Skeleton className="size-40 rounded-full" />
              <div className="w-full space-y-2.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ) : donut.length === 0 ? (
            <EmptyState
              compact
              icon={PieChart}
              title="No work to chart yet"
              description="Tasks will appear here once they're created."
            />
          ) : (
            <>
              <Donut total={donutTotal} slices={donut} />
              <ul className="mt-5 space-y-1">
                {donut.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-sm"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: item.color }}
                    />
                    <span className="min-w-0 flex-1 truncate capitalize text-muted-foreground">
                      {item.label}
                    </span>
                    <span className="font-medium text-foreground tabular">
                      {item.count.toLocaleString()}
                    </span>
                    <span className="w-10 text-right text-xs text-subtle-foreground tabular">
                      {donutTotal
                        ? `${Math.round((item.count / donutTotal) * 100)}%`
                        : "0%"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Surface>
      </div>

      {/* Today + side column */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <CardHeading
              icon={Sun}
              title="Today's tasks"
              description={
                todayTasks.length
                  ? `${todayTasks.length} on your plate`
                  : undefined
              }
            />
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/my-day">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {dashboard.isLoading && myDay.isLoading ? (
            <div className="divide-y divide-border border-t border-border">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="hidden h-3.5 w-24 sm:block" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
                </div>
              ))}
            </div>
          ) : todayTasks.length === 0 ? (
            <div className="border-t border-border">
              <EmptyState
                compact
                icon={Sun}
                title="Nothing due today"
                description="Tasks scheduled or due today will show up here."
                action={
                  canWrite ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTaskCreate()}
                    >
                      <Plus />
                      Create task
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden border-t border-border sm:block">
                <Table className="min-w-[600px] table-fixed">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">Task</TableHead>
                      <TableHead className="w-[22%]">Project</TableHead>
                      <TableHead className="w-24">Priority</TableHead>
                      <TableHead className="w-28">Due</TableHead>
                      <TableHead className="w-32 pr-5">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayTasks.slice(0, 8).map((task) => (
                      <TaskRow key={task.id} task={task} canWrite={canWrite} />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile stacked rows */}
              <ul className="divide-y divide-border border-t border-border sm:hidden">
                {todayTasks.slice(0, 8).map((task) => (
                  <TaskCardRow key={task.id} task={task} canWrite={canWrite} />
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <UpcomingPanel data={data} loading={dashboard.isLoading} />
        </div>
        <div className="lg:col-span-2">
          <RecentActivityPanel data={data} loading={dashboard.isLoading} />
        </div>
      </div>
    </PageShell>
  );
}

function CardHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CheckSquare;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-md font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="truncate text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-8 w-14" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

function LegendStat({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span
          aria-hidden
          className="h-0.5 w-3 rounded-full"
          style={{ background: swatch }}
        />
        {label}
      </p>
      <p className="mt-0.5 font-heading text-xl font-semibold tracking-[-0.02em] text-foreground tabular">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function StartCheckbox({
  task,
  canWrite,
}: {
  task: InsightTask | DashboardTask;
  canWrite: boolean;
}) {
  const start = useStartTask();
  const canStart = canWrite && canStartTask(task.status);
  const done = task.status === "COMPLETED";

  return (
    <Tooltip content={canStart ? "Start work" : undefined}>
      <button
        type="button"
        aria-label={canStart ? `Start work on ${task.title}` : "Task status"}
        disabled={!canStart || start.isPending}
        onClick={() => {
          if (!canStart) return;
          void start
            .mutateAsync(task.id)
            .then(() => toast.success("Task started"))
            .catch(() => undefined);
        }}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
          done
            ? "border-success bg-success"
            : canStart
              ? "border-border-strong bg-card hover:border-primary hover:bg-primary-soft"
              : "border-primary bg-primary-soft",
          start.isPending && "animate-pulse",
        )}
      />
    </Tooltip>
  );
}

function TaskRow({
  task,
  canWrite,
}: {
  task: InsightTask | DashboardTask;
  canWrite: boolean;
}) {
  const late = isOverdue(task);
  return (
    <TableRow>
      <TableCell className="pl-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <StartCheckbox task={task} canWrite={canWrite} />
          <Link
            href={`/app/tasks/${task.id}`}
            className="truncate rounded-sm font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {task.title}
          </Link>
        </div>
      </TableCell>
      <TableCell className="truncate text-sm text-muted-foreground">
        {task.project?.name ?? "—"}
      </TableCell>
      <TableCell>
        <PriorityBadge value={task.priority} />
      </TableCell>
      <TableCell
        className={cn(
          "whitespace-nowrap text-sm tabular",
          late ? "text-danger-soft-foreground" : "text-muted-foreground",
        )}
      >
        {task.dueDate ? formatDate(task.dueDate) : "—"}
      </TableCell>
      <TableCell className="pr-5">
        <StatusBadge value={task.status} />
      </TableCell>
    </TableRow>
  );
}

function TaskCardRow({
  task,
  canWrite,
}: {
  task: InsightTask | DashboardTask;
  canWrite: boolean;
}) {
  const late = isOverdue(task);
  return (
    <li className="flex gap-3 px-4 py-3">
      <div className="pt-0.5">
        <StartCheckbox task={task} canWrite={canWrite} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Link
          href={`/app/tasks/${task.id}`}
          className="block truncate rounded-sm text-base font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {task.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {task.project?.name ?? "No project"}
          {task.dueDate ? (
            <span className={cn(late && "text-danger-soft-foreground")}>
              {" · "}Due {formatDate(task.dueDate)}
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge value={task.status} />
          <PriorityBadge value={task.priority} />
        </div>
      </div>
    </li>
  );
}

function UpcomingPanel({
  data,
  loading,
}: {
  data: DashboardResponse | undefined;
  loading: boolean;
}) {
  const meetingItems = data?.upcomingMeetings.items ?? [];
  const deadlines = data?.upcomingDeadlines ?? [];
  const items = [
    ...meetingItems.map((meeting) => ({
      id: `m-${meeting.id}`,
      kind: "meeting" as const,
      title: meeting.title,
      at: meeting.startAt,
      href: `/app/meetings/${meeting.id}`,
      meta:
        meeting.project?.name ??
        meeting.team?.name ??
        (meeting.mode === "ONLINE" || meeting.meetingLink
          ? "Online"
          : "Meeting"),
    })),
    ...deadlines.map((deadline) => ({
      id: `d-${deadline.id}`,
      kind: "deadline" as const,
      title: deadline.title,
      at: deadline.dueDate,
      href: deadline.href,
      meta: deadline.meta,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5);

  return (
    <Surface className="p-0 sm:p-0">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5 sm:px-5">
        <CardHeading icon={CalendarClock} title="Coming up" />
        <Button asChild size="xs" variant="ghost">
          <Link href="/app/calendar">Calendar</Link>
        </Button>
      </div>
      {loading ? (
        <div className="space-y-3 px-4 pb-4 sm:px-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarClock}
          title="Nothing scheduled"
          description="Meetings and deadlines this week will appear here."
        />
      ) : (
        <ul className="px-2 pb-2 sm:px-3">
          {items.map((item) => {
            const date = new Date(item.at);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-background">
                    <span className="text-2xs font-medium uppercase leading-none text-subtle-foreground">
                      {date.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="mt-0.5 text-sm font-semibold leading-none text-foreground tabular">
                      {date.getDate()}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {item.kind === "meeting" ? (
                        <CalendarDays className="size-3 shrink-0 text-info" />
                      ) : (
                        <Flag className="size-3 shrink-0 text-warning" />
                      )}
                      <span className="truncate">
                        {item.kind === "meeting"
                          ? `${formatTime(item.at)} · ${item.meta}`
                          : item.meta || "Deadline"}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

function RecentActivityPanel({
  data,
  loading,
}: {
  data: DashboardResponse | undefined;
  loading: boolean;
}) {
  const items = (data?.recentActivity ?? []).slice(0, 5);

  return (
    <Surface className="p-0 sm:p-0">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5 sm:px-5">
        <CardHeading icon={ActivityIcon} title="Recent activity" />
        <Button asChild size="xs" variant="ghost">
          <Link href="/app/activity">See all</Link>
        </Button>
      </div>
      {loading ? (
        <div className="space-y-3 px-4 pb-4 sm:px-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={ActivityIcon}
          title="No activity yet"
          description="Changes across the workspace will show up here."
        />
      ) : (
        <ul className="px-2 pb-2 sm:px-3">
          {items.map((item) => {
            const href = activityHref(item.entityType, item.entityId);
            const actor = item.actor?.name ?? "Someone";
            const body = (
              <>
                <Avatar name={actor} size="sm" className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{actor}</span>{" "}
                    {item.title}
                  </span>
                  <span className="text-xs text-subtle-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={item.id}>
                {href ? (
                  <Link
                    href={href}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-2.5 px-2 py-2">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const rawStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= rawStep) ?? 10;
  return step * magnitude * 4;
}

function TrendChart({
  labels,
  created,
  completed,
}: {
  labels: string[];
  created: number[];
  completed: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(640);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setMeasured(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(280, measured);
  const height = 224;
  const pad = { l: 32, r: 12, t: 12, b: 28 };
  const max = niceMax(Math.max(1, ...created, ...completed));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (index: number) =>
    pad.l +
    (labels.length <= 1 ? innerW / 2 : (index / (labels.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / max) * innerH;
  const path = (values: number[]) =>
    values
      .map(
        (value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`,
      )
      .join(" ");
  const area = (values: number[]) =>
    values.length
      ? `${path(values)} L ${x(values.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`
      : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={ref} className="mt-4 w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-56 w-full"
        role="img"
        aria-label={`Created vs completed: ${created.reduce((a, b) => a + b, 0)} created, ${completed.reduce((a, b) => a + b, 0)} completed`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(max * tick)}
              y2={y(max * tick)}
              style={{ stroke: "var(--border)" }}
              strokeDasharray={tick === 0 ? undefined : "3 5"}
            />
            <text
              x={pad.l - 8}
              y={y(max * tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-subtle-foreground text-2xs tabular"
            >
              {Math.round(max * tick)}
            </text>
          </g>
        ))}
        <path
          d={area(created)}
          style={{ fill: "var(--chart-1)" }}
          fillOpacity={0.08}
        />
        <path
          d={area(completed)}
          style={{ fill: "var(--success)" }}
          fillOpacity={0.08}
        />
        <path
          d={path(created)}
          fill="none"
          style={{ stroke: "var(--chart-1)" }}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path(completed)}
          fill="none"
          style={{ stroke: "var(--success)" }}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {created.map((value, index) => (
          <circle
            key={`c-${index}`}
            cx={x(index)}
            cy={y(value)}
            r="3"
            strokeWidth="2"
            style={{ fill: "var(--card)", stroke: "var(--chart-1)" }}
          >
            <title>{`${labels[index]} · ${value} created`}</title>
          </circle>
        ))}
        {completed.map((value, index) => (
          <circle
            key={`d-${index}`}
            cx={x(index)}
            cy={y(value)}
            r="3"
            strokeWidth="2"
            style={{ fill: "var(--card)", stroke: "var(--success)" }}
          >
            <title>{`${labels[index]} · ${value} completed`}</title>
          </circle>
        ))}
        {labels.map((label, index) => (
          <text
            key={label + index}
            x={x(index)}
            y={height - 8}
            textAnchor={
              index === 0
                ? "start"
                : index === labels.length - 1
                  ? "end"
                  : "middle"
            }
            className="fill-subtle-foreground text-2xs"
          >
            {labels.length > 8 && index % 2 === 1 ? "" : label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Donut({
  total,
  slices,
}: {
  total: number;
  slices: Array<{ label: string; count: number; color: string }>;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0;
  // Compute each slice's start offset up front so render stays pure.
  const arcs = slices.map((slice, index) => {
    const len = total ? (slice.count / total) * c : 0;
    const start = slices
      .slice(0, index)
      .reduce((sum, prev) => sum + (total ? (prev.count / total) * c : 0), 0);
    return { ...slice, len, start };
  });

  return (
    <div className="relative mx-auto mt-5 size-40">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          style={{ stroke: "var(--muted)" }}
          strokeWidth="14"
        />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            style={{ stroke: arc.color }}
            strokeWidth="14"
            strokeDasharray={`${Math.max(0, arc.len - gap)} ${c - Math.max(0, arc.len - gap)}`}
            strokeDashoffset={-arc.start}
          >
            <title>{`${arc.label}: ${arc.count}`}</title>
          </circle>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-heading text-2xl font-semibold tracking-[-0.02em] text-foreground tabular">
          {total.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">tasks</p>
      </div>
    </div>
  );
}
