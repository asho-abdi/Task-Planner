"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FolderKanban,
  Loader2,
  Printer,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  SegmentedControl,
  Surface,
} from "@/components/page-header";
import { PersonAvatar } from "@/components/member-avatar-group";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DonutChart,
  KpiCard,
  Meter,
  PageControls,
  TrendChart,
} from "@/features/insights/ui";
import { useDashboard, useMyDay, useReports } from "@/features/insights/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useTeams } from "@/features/collaboration/hooks";
import { useActivity } from "@/features/chat/hooks";
import { activityHref } from "@/features/chat/types";
import { useTasks } from "@/features/tasks/hooks";
import {
  PRIORITIES,
  TASK_STATUSES,
  taskStatusLabel,
  type Priority,
  type TaskStatus,
} from "@/features/tasks/types";
import { useCurrentUser } from "@/features/auth/hooks";
import { useWorkspaceMembers } from "@/features/workspaces/hooks";
import { AiNarrativeCard } from "@/features/ai/ui";
import {
  cn,
  formatDate,
  formatRelativeTime,
  localDateYmd,
  nativeSelectClass,
} from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

type RangePreset = "today" | "week" | "month" | "30" | "90" | "custom";
type TrendGrain = "daily" | "weekly" | "monthly";

const STATUS_SLICES: Array<{ key: string; color: string }> = [
  { key: "TODO", color: "var(--chart-6)" },
  { key: "IN_PROGRESS", color: "var(--chart-1)" },
  { key: "IN_REVIEW", color: "var(--chart-3)" },
  { key: "COMPLETED", color: "var(--success)" },
  { key: "RETURNED", color: "var(--chart-4)" },
  { key: "OVERDUE", color: "var(--danger)" },
];

function shiftYmd(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateYmd(date);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
}

function rangeForPreset(preset: RangePreset, customFrom: string, customTo: string) {
  const today = new Date();
  const to = localDateYmd(today);
  if (preset === "custom") {
    return { from: customFrom || shiftYmd(to, -29), to: customTo || to };
  }
  if (preset === "today") return { from: to, to };
  if (preset === "week") return { from: localDateYmd(startOfWeek(today)), to };
  if (preset === "month") {
    return {
      from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
      to,
    };
  }
  if (preset === "90") return { from: shiftYmd(to, -89), to };
  return { from: shiftYmd(to, -29), to };
}

function previousRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
  );
  const prevTo = shiftYmd(from, -1);
  const prevFrom = shiftYmd(prevTo, 1 - days);
  return { from: prevFrom, to: prevTo };
}

function changeOf(
  current: number,
  previous: number,
): { percent: number; up: boolean } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { percent: 100, up: true };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return null;
  return { percent: Math.abs(percent), up: percent > 0 };
}

function bucketTrends(
  rows: Array<{ day: string; created: number; completed: number }>,
  grain: TrendGrain,
) {
  if (grain === "daily") {
    return rows.map((row) => ({
      label: new Date(`${row.day}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      created: row.created,
      completed: row.completed,
    }));
  }
  const map = new Map<string, { created: number; completed: number }>();
  for (const row of rows) {
    const date = new Date(`${row.day}T00:00:00`);
    const key =
      grain === "weekly"
        ? localDateYmd(startOfWeek(date))
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = map.get(key) ?? { created: 0, completed: 0 };
    current.created += row.created;
    current.completed += row.completed;
    map.set(key, current);
  }
  return [...map.entries()].map(([key, value]) => ({
    label:
      grain === "weekly"
        ? `W ${new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, {
            month: "short",
            year: "2-digit",
          }),
    ...value,
  }));
}

function projectHealth(completed: number, open: number, overdue: number) {
  if (overdue > 0 && completed + open > 0 && overdue / (completed + open) >= 0.25) {
    return { label: "Delayed", className: "bg-danger-soft text-danger" };
  }
  if (overdue > 0) {
    return { label: "At risk", className: "bg-warning-soft text-warning" };
  }
  return { label: "Healthy", className: "bg-success-soft text-success" };
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const user = useCurrentUser();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [preset, setPreset] = useState<RangePreset>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [grain, setGrain] = useState<TrendGrain>("daily");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const { from, to } = rangeForPreset(preset, customFrom, customTo);
  const prior = previousRange(from, to);
  const reportParams = {
    from,
    to,
    page,
    pageSize,
    projectId: projectId || undefined,
    teamId: teamId || undefined,
    userId: userId || undefined,
  };

  const projects = useProjects(workspaceId);
  const teams = useTeams(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const reports = useReports(workspaceId, reportParams);
  const previous = useReports(workspaceId, {
    ...reportParams,
    page: 1,
    from: prior.from,
    to: prior.to,
  });
  const myDay = useMyDay(workspaceId, localDateYmd());
  const dashboard = useDashboard(workspaceId);
  const activity = useActivity(workspaceId);
  const overdueTasks = useTasks(workspaceId, {
    status: "OVERDUE",
    projectId: projectId || undefined,
    assigneeId: userId || undefined,
    priority: priority || undefined,
    pageSize: 8,
  });
  const reviewTasks = useTasks(workspaceId, {
    status: "IN_REVIEW",
    projectId: projectId || undefined,
    assigneeId: userId || undefined,
    priority: priority || undefined,
    pageSize: 8,
  });
  const returnedTasks = useTasks(workspaceId, {
    status: "RETURNED",
    projectId: projectId || undefined,
    assigneeId: userId || undefined,
    priority: priority || undefined,
    pageSize: 8,
  });

  const byStatus = reports.data?.completion.byStatus ?? {};
  const totalTasks =
    (reports.data?.completion.completed ?? 0) + (reports.data?.completion.open ?? 0);
  const completed = reports.data?.completion.completed ?? 0;
  const inProgress = byStatus.IN_PROGRESS ?? 0;
  const inReview = byStatus.IN_REVIEW ?? 0;
  const overdue = reports.data?.overdue.count ?? 0;
  const prevByStatus = previous.data?.completion.byStatus ?? {};
  const prevTotal =
    (previous.data?.completion.completed ?? 0) +
    (previous.data?.completion.open ?? 0);

  const slices = STATUS_SLICES.map((item) => ({
    label: taskStatusLabel(item.key),
    count: byStatus[item.key] ?? 0,
    color: item.color,
  }));
  const donutTotal = slices.reduce((sum, item) => sum + item.count, 0);

  const trendRows = bucketTrends(reports.data?.trends ?? [], grain);

  const attention = useMemo(() => {
    const seen = new Set<string>();
    const rows = [
      ...(overdueTasks.data?.items ?? []),
      ...(reviewTasks.data?.items ?? []),
      ...(returnedTasks.data?.items ?? []),
    ].filter((task) => {
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
    return rows.slice(0, 12);
  }, [overdueTasks.data, reviewTasks.data, returnedTasks.data, status, priority]);

  const dueSoon = (dashboard.data?.upcomingDeadlines ?? [])
    .filter((item) => item.kind === "task")
    .slice(0, 6);

  const recent = (activity.data ?? [])
    .filter((item) => {
      const title = item.title.toLowerCase();
      return (
        item.entityType === "task" ||
        item.entityType === "project" ||
        title.includes("complet") ||
        title.includes("submit") ||
        title.includes("return") ||
        title.includes("assign") ||
        title.includes("due")
      );
    })
    .slice(0, 8);

  const myOpen = myDay.data?.todayTasks.items ?? [];
  const myOverdue = myDay.data?.overdueTasks?.items ?? [];
  const myCompleted = myDay.data?.completedTasks?.items ?? [];
  const myAssigned = myOpen.length + myOverdue.length + myCompleted.length;
  const myRate = myAssigned
    ? Math.round((myCompleted.length / myAssigned) * 100)
    : 0;

  const teamUsers = [...(reports.data?.workload.users ?? [])].sort(
    (a, b) => b.openTaskCount - a.openTaskCount,
  );

  const hasFilters = Boolean(
    projectId || teamId || userId || status || priority || preset !== "30",
  );

  function clearFilters() {
    setPreset("30");
    setCustomFrom("");
    setCustomTo("");
    setProjectId("");
    setTeamId("");
    setUserId("");
    setStatus("");
    setPriority("");
    setPage(1);
  }

  function exportCsv() {
    if (!reports.data) return;
    const rows: string[][] = [
      ["Reports & Analytics"],
      ["Range", from, to],
      ["Generated", new Date().toISOString()],
      [],
      ["KPI", "Value"],
      ["Total projects", String(reports.data.projectPerformance.total)],
      ["Total tasks", String(totalTasks)],
      ["Completed", String(completed)],
      ["In progress", String(inProgress)],
      ["Pending review", String(inReview)],
      ["Overdue", String(overdue)],
      [],
      ["Project", "Total", "Completed", "Open", "Overdue", "Completion %"],
      ...reports.data.projectPerformance.items.map((project) => [
        project.name,
        String(project.total),
        String(project.completed),
        String(project.open),
        String(project.overdue),
        String(Math.round(project.completionRate * 100)),
      ]),
      [],
      ["Team member", "Open tasks", "Load %", "Deadlines this week"],
      ...teamUsers.map((member) => [
        member.name,
        String(member.openTaskCount),
        String(Math.round(member.utilization * 100)),
        String(member.weekDeadlineCount),
      ]),
    ];
    downloadCsv(`reports-${from}-to-${to}.csv`, rows);
    setExportOpen(false);
  }

  const filterBar = (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      {preset === "custom" ? (
        <>
          <input
            type="date"
            className={cn(nativeSelectClass, "h-8")}
            value={from}
            onChange={(event) => {
              setCustomFrom(event.target.value);
              setPage(1);
            }}
            aria-label="From"
          />
          <input
            type="date"
            className={cn(nativeSelectClass, "h-8")}
            value={to}
            onChange={(event) => {
              setCustomTo(event.target.value);
              setPage(1);
            }}
            aria-label="To"
          />
        </>
      ) : null}
      <select
        className={cn(nativeSelectClass, "h-8")}
        value={projectId}
        onChange={(event) => {
          setPage(1);
          setProjectId(event.target.value);
        }}
        aria-label="Project"
      >
        <option value="">All projects</option>
        {(projects.data ?? []).map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <select
        className={cn(nativeSelectClass, "h-8")}
        value={teamId}
        onChange={(event) => {
          setPage(1);
          setTeamId(event.target.value);
        }}
        aria-label="Team"
      >
        <option value="">All teams</option>
        {(teams.data ?? []).map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <select
        className={cn(nativeSelectClass, "h-8")}
        value={userId}
        onChange={(event) => {
          setPage(1);
          setUserId(event.target.value);
        }}
        aria-label="Team member"
      >
        <option value="">All members</option>
        {(members.data ?? []).map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.user.name}
          </option>
        ))}
      </select>
      <select
        className={cn(nativeSelectClass, "h-8")}
        value={status}
        onChange={(event) => setStatus(event.target.value as TaskStatus | "")}
        aria-label="Task status"
      >
        <option value="">Any status</option>
        {TASK_STATUSES.filter((item) => item !== "ARCHIVED").map((item) => (
          <option key={item} value={item}>
            {taskStatusLabel(item)}
          </option>
        ))}
      </select>
      <select
        className={cn(nativeSelectClass, "h-8")}
        value={priority}
        onChange={(event) => setPriority(event.target.value as Priority | "")}
        aria-label="Priority"
      >
        <option value="">Any priority</option>
        {PRIORITIES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <PageShell className="max-w-[1180px] space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Track productivity, task progress, team performance, and project health."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={preset}
              onChange={(value) => {
                setPreset(value);
                setPage(1);
              }}
              className="hidden xl:inline-flex"
              options={[
                { value: "today", label: "Today" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "30", label: "30d" },
                { value: "90", label: "3m" },
                { value: "custom", label: "Custom" },
              ]}
            />
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExportOpen((open) => !open)}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              {exportOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[0_12px_32px_rgba(15,23,42,0.1)]">
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onClick={exportCsv}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                    onClick={() => {
                      setExportOpen(false);
                      window.print();
                    }}
                  >
                    Export PDF
                  </button>
                </div>
              ) : null}
            </div>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <p className="text-[12px] text-subtle-foreground">
        {formatDate(from)} – {formatDate(to)}
      </p>

      <div className="no-print xl:hidden">
        <select
          className={cn(nativeSelectClass, "h-8")}
          value={preset}
          onChange={(event) => {
            setPreset(event.target.value as RangePreset);
            setPage(1);
          }}
          aria-label="Date range"
        >
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 3 months</option>
          <option value="custom">Custom range</option>
        </select>
      </div>

      <Surface className="no-print space-y-3 p-4 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-foreground">Filters</p>
          <div className="flex items-center gap-3">
            {hasFilters ? (
              <button
                type="button"
                className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
            <button
              type="button"
              className="text-[12px] font-medium text-primary lg:hidden"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className={cn("lg:block", filtersOpen ? "block" : "hidden")}>
          {filterBar}
        </div>
      </Surface>

      {reports.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : reports.isError ? (
        <p className="text-sm text-destructive">{reports.error.message}</p>
      ) : !reports.data ? (
        <EmptyState title="Unable to load reports" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Total projects"
              value={reports.data.projectPerformance.total}
              icon={<FolderKanban className="h-4 w-4" />}
              hint="in this range"
            />
            <KpiCard
              label="Total tasks"
              value={totalTasks}
              icon={<ClipboardList className="h-4 w-4" />}
              change={changeOf(totalTasks, prevTotal)}
              hint="vs previous period"
            />
            <KpiCard
              label="Completed tasks"
              value={completed}
              icon={<CheckCircle2 className="h-4 w-4" />}
              change={changeOf(
                completed,
                previous.data?.completion.completed ?? 0,
              )}
            />
            <KpiCard
              label="In progress"
              value={inProgress}
              icon={<Loader2 className="h-4 w-4" />}
              change={changeOf(inProgress, prevByStatus.IN_PROGRESS ?? 0)}
            />
            <KpiCard
              label="Pending review"
              value={inReview}
              change={changeOf(inReview, prevByStatus.IN_REVIEW ?? 0)}
            />
            <KpiCard
              label="Overdue tasks"
              value={overdue}
              icon={<AlertTriangle className="h-4 w-4" />}
              change={changeOf(overdue, previous.data?.overdue.count ?? 0)}
            />
          </div>

          <AiNarrativeCard from={from} to={to} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Surface>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
                Task overview
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Status mix from live workspace tasks.
              </p>
              {donutTotal === 0 ? (
                <EmptyState title="No tasks in this range" />
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                  <DonutChart total={donutTotal} slices={slices} />
                  <div className="space-y-2.5">
                    {slices.map((slice) => {
                      const pct = donutTotal
                        ? Math.round((slice.count / donutTotal) * 100)
                        : 0;
                      return (
                        <div key={slice.label}>
                          <div className="mb-1 flex items-center justify-between text-[12px]">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: slice.color }}
                              />
                              {slice.label}
                            </span>
                            <span className="tabular-nums text-foreground">
                              {slice.count} · {pct}%
                            </span>
                          </div>
                          <Meter value={pct} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Surface>

            <Surface>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
                    Task completion trend
                  </h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Created vs completed in the selected range.
                  </p>
                </div>
                <SegmentedControl
                  value={grain}
                  onChange={setGrain}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                />
              </div>
              {(reports.data.trends ?? []).length === 0 ? (
                <EmptyState title="No trend data yet" />
              ) : (
                <>
                  <TrendChart
                    labels={trendRows.map((row) => row.label)}
                    series={[
                      {
                        label: "Created",
                        values: trendRows.map((row) => row.created),
                        color: "var(--chart-1)",
                      },
                      {
                        label: "Completed",
                        values: trendRows.map((row) => row.completed),
                        color: "var(--success)",
                      },
                    ]}
                  />
                  <div className="mt-2 flex gap-4 text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary" /> Created
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-success" />{" "}
                      Completed
                    </span>
                  </div>
                </>
              )}
            </Surface>
          </div>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
                  Project performance
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Completion and health by project.
                </p>
              </div>
            </div>
            {reports.data.projectPerformance.items.length === 0 ? (
              <EmptyState title="No project data in this range" />
            ) : (
              <ListPanel className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">
                    <tr>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-3 py-3">Total</th>
                      <th className="px-3 py-3">Done</th>
                      <th className="px-3 py-3">Open</th>
                      <th className="px-3 py-3">Overdue</th>
                      <th className="px-3 py-3">Progress</th>
                      <th className="px-4 py-3">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reports.data.projectPerformance.items.map((project) => {
                      const health = projectHealth(
                        project.completed,
                        project.open,
                        project.overdue,
                      );
                      const pct = Math.round(project.completionRate * 100);
                      return (
                        <tr key={project.projectId ?? "none"} className="hover:bg-muted">
                          <td className="px-4 py-3">
                            {project.projectId ? (
                              <Link
                                href={`/app/projects/${project.projectId}`}
                                className="font-medium text-foreground hover:text-primary"
                              >
                                {project.name}
                              </Link>
                            ) : (
                              <span className="font-medium">{project.name}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            {project.total}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            {project.completed}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            {project.open}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            {project.overdue}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Meter className="w-24" value={pct} />
                              <span className="tabular-nums text-muted-foreground">
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[11px] font-medium",
                                health.className,
                              )}
                            >
                              {health.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ListPanel>
            )}
            <PageControls
              page={page}
              pageCount={Math.max(
                1,
                Math.ceil(reports.data.projectPerformance.total / pageSize),
              )}
              onPageChange={setPage}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Surface>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
                Team performance
              </h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Open load and capacity from live assignments.
                </p>
                {teamUsers.length === 0 ? (
                  <EmptyState title="No team workload in this view" />
                ) : (
                  <div className="mt-4 space-y-3">
                    {teamUsers.slice(0, 3).map((member, index) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5"
                      >
                        <span className="w-5 text-[12px] font-semibold text-subtle-foreground">
                          {index + 1}
                        </span>
                        <PersonAvatar name={member.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">
                            {member.name}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            {member.openTaskCount} open ·{" "}
                            {member.weekDeadlineCount} due this week
                          </p>
                        </div>
                        <span className="text-[12px] tabular-nums text-muted-foreground">
                          {Math.round(member.utilization * 100)}% load
                        </span>
                      </div>
                    ))}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-[13px]">
                        <thead className="text-[11px] uppercase tracking-wide text-subtle-foreground">
                          <tr>
                            <th className="py-2">Member</th>
                            <th>Open</th>
                            <th>Due soon</th>
                            <th>Load</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamUsers.map((member) => (
                            <tr key={member.userId} className="border-t border-muted">
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <PersonAvatar name={member.name} size="sm" />
                                  {member.name}
                                </div>
                              </td>
                              <td className="tabular-nums text-muted-foreground">
                                {member.openTaskCount}
                              </td>
                              <td className="tabular-nums text-muted-foreground">
                                {member.weekDeadlineCount}
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <Meter
                                    className="w-16"
                                    value={Math.round(member.utilization * 100)}
                                    danger={member.overloaded}
                                  />
                                  {member.overloaded ? (
                                    <span className="text-[11px] text-danger">
                                      High
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Surface>

            <Surface>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
                My productivity
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Your work for today, {user.data?.name?.split(" ")[0] ?? "you"}.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[22px] font-semibold">{myAssigned}</p>
                  <p className="text-[12px] text-muted-foreground">Assigned</p>
                </div>
                <div>
                  <p className="text-[22px] font-semibold">{myCompleted.length}</p>
                  <p className="text-[12px] text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-[22px] font-semibold">{myOpen.length}</p>
                  <p className="text-[12px] text-muted-foreground">Pending</p>
                </div>
                <div>
                  <p className="text-[22px] font-semibold">{myOverdue.length}</p>
                  <p className="text-[12px] text-muted-foreground">Overdue</p>
                </div>
              </div>
              <p className="mt-4 text-[12px] text-muted-foreground">Completion rate</p>
              <Meter className="mt-1.5" value={myRate} />
              <p className="mt-1 text-[13px] font-medium">{myRate}%</p>
              <p className="mt-3 text-[12px] text-subtle-foreground">
                Average completion time is not tracked in this workspace yet.
              </p>
              {dashboard.data ? (
                <div className="mt-3 text-[12px] text-muted-foreground">
                  Workspace snapshot: {dashboard.data.totals.completed} completed
                  · {dashboard.data.totals.overdue} overdue
                </div>
              ) : null}
            </Surface>
          </div>

          <section>
            <h2 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
              Attention required
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Overdue, returned, and waiting for review.
            </p>
            {attention.length === 0 && dueSoon.length === 0 ? (
              <EmptyState title="Nothing needs attention" />
            ) : (
              <ListPanel className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="border-b border-border text-[11px] uppercase tracking-wide text-subtle-foreground">
                    <tr>
                      <th className="px-4 py-3">Task</th>
                      <th className="px-3 py-3">Project</th>
                      <th className="px-3 py-3">Assignee</th>
                      <th className="px-3 py-3">Due</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attention.map((task) => (
                      <tr key={task.id} className="hover:bg-muted">
                        <td className="px-4 py-3">
                          <Link
                            href={`/app/tasks/${task.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {task.title}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {task.project?.name ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {(task.assignees ?? []).length
                            ? (task.assignees ?? [])
                                .map((person) => person.name)
                                .join(", ")
                            : (task.assignee?.name ?? "Unassigned")}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {formatDate(task.dueDate)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge value={task.status} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={task.priority} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dueSoon.length ? (
                  <div className="border-t border-border px-4 py-3">
                    <p className="text-[12px] font-medium text-muted-foreground">
                      Due soon
                    </p>
                    <ul className="mt-2 space-y-1">
                      {dueSoon.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className="text-[13px] hover:text-primary"
                          >
                            {item.title}
                            <span className="ml-2 text-subtle-foreground">
                              {formatDate(item.dueDate)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </ListPanel>
            )}
          </section>

          <Surface>
            <h2 className="text-[15px] font-bold tracking-[-0.02em] text-foreground">
              Recent activity
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Completions, submissions, assignments, and related changes.
            </p>
            {recent.length === 0 ? (
              <EmptyState title="No recent activity" />
            ) : (
              <ol className="mt-3 divide-y divide-muted">
                {recent.map((item) => {
                  const href = activityHref(item.entityType, item.entityId);
                  const body = (
                    <div className="flex items-start justify-between gap-3 py-2.5">
                      <p className="text-[13px] text-foreground">
                        <span className="font-medium">
                          {item.actor?.name ?? "Someone"}
                        </span>{" "}
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[12px] text-subtle-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                  );
                  return (
                    <li key={item.id}>
                      {href ? (
                        <Link href={href} className="block hover:text-primary">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Surface>
        </>
      )}
    </PageShell>
  );
}
