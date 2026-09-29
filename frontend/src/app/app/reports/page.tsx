"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  ListFilter,
  PieChart,
  Printer,
  SlidersHorizontal,
  Timer,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  SegmentedControl,
  StatCard,
  Surface,
} from "@/components/page-header";
import { PersonAvatar } from "@/components/member-avatar-group";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge, PriorityBadge, StatusBadge, type BadgeVariant } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/empty-state";
import { Progress, ProgressRing } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarList,
  ChartLegend,
  DonutChart,
  Meter,
  PageControls,
  TrendChart,
  utilizationTone,
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

function projectHealth(
  completed: number,
  open: number,
  overdue: number,
): { label: string; variant: BadgeVariant } {
  if (overdue > 0 && completed + open > 0 && overdue / (completed + open) >= 0.25) {
    return { label: "Delayed", variant: "danger" };
  }
  if (overdue > 0) {
    return { label: "At risk", variant: "warning" };
  }
  return { label: "Healthy", variant: "success" };
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

  // Resolves task names for activity rows ("approved task" → which task).
  const recentTasks = useTasks(workspaceId, { pageSize: 100 });
  const taskTitles = useMemo(
    () => new Map((recentTasks.data?.items ?? []).map((task) => [task.id, task.title])),
    [recentTasks.data],
  );

  const byStatus = reports.data?.completion.byStatus ?? {};
  const totalTasks =
    (reports.data?.completion.completed ?? 0) + (reports.data?.completion.open ?? 0);
  const completed = reports.data?.completion.completed ?? 0;
  const inProgress = byStatus.IN_PROGRESS ?? 0;
  const inReview = byStatus.IN_REVIEW ?? 0;
  const overdue = reports.data?.overdue.count ?? 0;
  // Same formula as the API (completed / all live tasks in scope), as a whole percent.
  const completionRate = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
  const hoursPerDay = reports.data?.hoursPerDay ?? 8;
  const teamLoad = reports.data?.workload.capacityHours
    ? Math.round((reports.data.workload.todayHours / reports.data.workload.capacityHours) * 100)
    : 0;
  // The API returns status/priority/project/overdue figures as a live snapshot (not
  // date-limited); only "created", the daily trend and meetings follow the date range.
  const createdInRange = reports.data?.completion.created ?? 0;
  const completedInRange = (reports.data?.trends ?? []).reduce((sum, row) => sum + row.completed, 0);
  const meetingsInRange = reports.data?.meetings?.count ?? 0;
  const prevCreated = previous.data?.completion.created ?? 0;
  const prevCompletedInRange = (previous.data?.trends ?? []).reduce(
    (sum, row) => sum + row.completed,
    0,
  );
  const prevMeetings = previous.data?.meetings?.count ?? 0;
  const openTasks = reports.data?.completion.open ?? 0;
  /** Previous-period value as a hint; only when that period has loaded. */
  const prevHint = (value: number, suffix = "") =>
    previous.data ? `Previous period: ${value}${suffix}` : undefined;
  /** Percent change, but only when the previous period had data (avoids a fake "+100%"). */
  const deltaVs = (current: number, prior: number) =>
    previous.data && prior > 0 ? deltaOf(changeOf(current, prior)) : null;

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
    projectId || teamId || userId || preset !== "30",
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
      ["Range: tasks created", String(createdInRange)],
      ["Range: tasks completed", String(completedInRange)],
      ["Live: total tasks", String(totalTasks)],
      ["Live: completed", String(completed)],
      ["Live: completion rate %", String(completionRate)],
      ["Range: meetings", String(meetingsInRange)],
      ["Live: in progress", String(inProgress)],
      ["Live: pending review", String(inReview)],
      ["Live: overdue", String(overdue)],
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

  const activeFilterCount = [projectId, teamId, userId].filter(
    Boolean,
  ).length;
  const byPriority = reports.data?.completion.byPriority ?? {};
  const priorityItems = PRIORITIES.map((item) => ({
    key: item,
    label: <PriorityBadge value={item} />,
    value: byPriority[item] ?? 0,
    color: PRIORITY_COLORS[item] ?? "var(--chart-6)",
  })).reverse();
  const priorityTotal = priorityItems.reduce((sum, item) => sum + item.value, 0);
  const today = localDateYmd();

  const filterBar = (
    <div className="grid gap-2 sm:grid-cols-3">
      <select
        className={nativeSelectClass}
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
        className={nativeSelectClass}
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
        className={nativeSelectClass}
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
    </div>
  );

  // Status/priority are not report API parameters, so they only filter the attention list.
  const attentionFilters = (
    <div className="no-print flex flex-wrap items-center gap-2">
      <ListFilter className="size-3.5 text-subtle-foreground" aria-hidden />
      <select
        className={cn(nativeSelectClass, "h-8 w-auto text-sm")}
        value={status}
        onChange={(event) => setStatus(event.target.value as TaskStatus | "")}
        aria-label="Filter attention list by status"
      >
        <option value="">Any status</option>
        {TASK_STATUSES.filter((item) => item !== "ARCHIVED").map((item) => (
          <option key={item} value={item}>
            {taskStatusLabel(item)}
          </option>
        ))}
      </select>
      <select
        className={cn(nativeSelectClass, "h-8 w-auto text-sm")}
        value={priority}
        onChange={(event) => setPriority(event.target.value as Priority | "")}
        aria-label="Filter attention list by priority"
      >
        <option value="">Any priority</option>
        {PRIORITIES.map((item) => (
          <option key={item} value={item}>
            {item.charAt(0) + item.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
    </div>
  );

  const scopeLabel = [
    projectId ? (projects.data ?? []).find((item) => item.id === projectId)?.name : null,
    teamId ? (teams.data ?? []).find((item) => item.id === teamId)?.name : null,
    userId ? (members.data ?? []).find((item) => item.userId === userId)?.user.name : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageShell>
      <PageHeader
        icon={BarChart3}
        title="Reports & Analytics"
        description="Track productivity, task progress, team performance, and project health."
        meta={
          <span className="inline-flex items-center gap-1.5 tabular">
            <CalendarRange className="size-3.5" />
            {formatDate(from)} – {formatDate(to)}
          </span>
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <DropdownMenu open={exportOpen} onOpenChange={setExportOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download />
                  Export
                  <ChevronDown className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem disabled={!reports.data} onSelect={exportCsv}>
                  <FileSpreadsheet />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setExportOpen(false);
                    window.print();
                  }}
                >
                  <FileText />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
          </div>
        }
      />

      <Surface className="no-print flex flex-col gap-3 p-3 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SegmentedControl
              label="Date range"
              value={preset}
              onChange={(value) => {
                setPreset(value);
                setPage(1);
              }}
              className="hidden md:inline-flex"
              options={[
                { value: "today", label: "Today" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "30", label: "30d" },
                { value: "90", label: "3m" },
                { value: "custom", label: "Custom" },
              ]}
            />
            <select
              className={cn(nativeSelectClass, "h-8 w-auto md:hidden")}
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
            {preset === "custom" ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  className={cn(nativeSelectClass, "h-8 w-auto")}
                  value={from}
                  onChange={(event) => {
                    setCustomFrom(event.target.value);
                    setPage(1);
                  }}
                  aria-label="From"
                />
                <span className="text-sm text-subtle-foreground">to</span>
                <input
                  type="date"
                  className={cn(nativeSelectClass, "h-8 w-auto")}
                  value={to}
                  onChange={(event) => {
                    setCustomTo(event.target.value);
                    setPage(1);
                  }}
                  aria-label="To"
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            {hasFilters ? (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X />
                Clear
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={filtersOpen ? "secondary" : "outline"}
              className="lg:hidden"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal />
              Filters
              {activeFilterCount ? (
                <Badge variant="primary" className="ml-0.5 h-4 px-1.5 text-2xs">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
          </div>
        </div>
        <div className={cn("lg:block", filtersOpen ? "block" : "hidden")}>
          {filterBar}
        </div>
      </Surface>

      {reports.isLoading ? (
        <ReportsSkeleton />
      ) : reports.isError ? (
        <ErrorState
          title="Couldn't load reports"
          description={reports.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void reports.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !reports.data ? (
        <EmptyState icon={BarChart3} title="Unable to load reports" />
      ) : (
        <>
          <ReportSummary
            from={from}
            to={to}
            scope={scopeLabel}
            totalTasks={totalTasks}
            completed={completed}
            completionRate={completionRate}
            createdInRange={createdInRange}
            completedInRange={completedInRange}
            open={reports.data.completion.open}
            overdue={overdue}
            inReview={inReview}
            projectsWithWork={reports.data.projectPerformance.total}
            meetings={reports.data.meetings?.count ?? 0}
            members={reports.data.workload.memberCount}
            overloaded={reports.data.workload.overloadedCount}
            teamLoad={teamLoad}
            todayHours={reports.data.workload.todayHours}
            capacityHours={reports.data.workload.capacityHours}
          />

          <div className="grid gap-4 xl:grid-cols-[3fr_4fr]">
            <section aria-labelledby="kpi-range" className="space-y-2">
              <KpiGroupLabel id="kpi-range" title="In selected range" note="vs previous period of equal length" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Tasks created"
                  value={createdInRange}
                  icon={ClipboardList}
                  tone="info"
                  delta={deltaVs(createdInRange, prevCreated)}
                  hint={prevHint(prevCreated)}
                />
                <StatCard
                  label="Tasks completed"
                  value={completedInRange}
                  icon={CheckCircle2}
                  tone="success"
                  delta={deltaVs(completedInRange, prevCompletedInRange)}
                  hint={prevHint(prevCompletedInRange)}
                />
                <StatCard
                  label="Meetings"
                  value={meetingsInRange}
                  icon={CalendarClock}
                  tone="primary"
                  delta={deltaVs(meetingsInRange, prevMeetings)}
                  hint={prevHint(prevMeetings)}
                />
              </div>
            </section>
            <section aria-labelledby="kpi-live" className="space-y-2">
              <KpiGroupLabel id="kpi-live" title="Right now" note="live status of all tasks in scope" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Open tasks"
                  value={openTasks}
                  icon={ListFilter}
                  tone="default"
                  hint={`of ${totalTasks} total`}
                />
                <StatCard
                  label="In progress"
                  value={inProgress}
                  icon={Timer}
                  tone="info"
                  hint={`${totalTasks ? Math.round((inProgress / totalTasks) * 100) : 0}% of tasks`}
                />
                <StatCard
                  label="In review"
                  value={inReview}
                  icon={Eye}
                  tone="warning"
                  hint={inReview ? "Waiting for a reviewer" : "Nothing waiting"}
                />
                <StatCard
                  label="Overdue"
                  value={overdue}
                  icon={AlertTriangle}
                  tone={overdue > 0 ? "danger" : "default"}
                  hint={overdue ? "Past due and not done" : "All on schedule"}
                />
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              className="lg:col-span-2"
              title="Status breakdown"
              description={`Live status of all ${donutTotal} tasks in scope (not limited by date).`}
            >
              {donutTotal === 0 ? (
                <EmptyState compact icon={PieChart} title="No tasks in this range" />
              ) : (
                <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
                  <DonutChart total={donutTotal} slices={slices} />
                  <ChartLegend
                    layout="stacked"
                    className="w-full min-w-0 flex-1 text-sm"
                    items={slices.map((slice) => ({
                      label: slice.label,
                      color: slice.color,
                      value: slice.count,
                      percent: donutTotal
                        ? Math.round((slice.count / donutTotal) * 100)
                        : 0,
                    }))}
                  />
                </div>
              )}
            </ChartCard>

            <ChartCard
              className="lg:col-span-3"
              title="Throughput"
              description={`${createdInRange} created · ${completedInRange} completed in this range (completion counted on the day a task was last updated).`}
              action={
                <SegmentedControl
                  label="Trend granularity"
                  value={grain}
                  onChange={setGrain}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                />
              }
            >
              {(reports.data.trends ?? []).length === 0 ? (
                <EmptyState compact icon={TrendingUp} title="No trend data yet" />
              ) : (
                <TrendChart
                  variant={trendRows.length <= 16 ? "bar" : "line"}
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
              )}
            </ChartCard>
          </div>

          <section className="space-y-3">
            <ListPanel>
              <PanelHeader
                title="By project"
                description={`Live totals for ${reports.data.projectPerformance.total} ${reports.data.projectPerformance.total === 1 ? "project" : "projects"} with tasks. At risk: any overdue task · Delayed: 25%+ overdue.`}
                icon={FolderKanban}
              />
              {reports.data.projectPerformance.items.length === 0 ? (
                <EmptyState compact icon={FolderKanban} title="No project data in this range" />
              ) : (
                <Table className="min-w-[680px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Done</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead className="w-48">Progress</TableHead>
                      <TableHead>Health</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.data.projectPerformance.items.map((project) => {
                      const health = projectHealth(
                        project.completed,
                        project.open,
                        project.overdue,
                      );
                      const pct = Math.round(project.completionRate * 100);
                      return (
                        <TableRow key={project.projectId ?? "none"}>
                          <TableCell>
                            {project.projectId ? (
                              <Link
                                href={`/app/projects/${project.projectId}`}
                                className="rounded-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {project.name}
                              </Link>
                            ) : (
                              <span className="font-medium text-foreground">{project.name}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular">
                            {project.total}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular">
                            {project.completed}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular">
                            {project.open}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular",
                              project.overdue > 0
                                ? "font-medium text-danger-soft-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {project.overdue}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Meter
                                className="h-2 flex-1"
                                value={pct}
                                tone={pct >= 100 ? "success" : "primary"}
                                label={`${project.name} ${pct}% complete`}
                              />
                              <span className="w-9 text-right text-sm text-muted-foreground tabular">
                                {pct}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={health.variant} dot>
                              {health.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ListPanel>
            <PageControls
              page={page}
              pageCount={Math.max(
                1,
                Math.ceil(reports.data.projectPerformance.total / pageSize),
              )}
              onPageChange={setPage}
            />
          </section>

          <div className="grid gap-4 items-start lg:grid-cols-5">
            <ListPanel className="lg:col-span-3">
              <PanelHeader
                title="By assignee"
                description={`Open tasks, deadlines this week, and today's scheduled hours against a ${hoursPerDay}h day.`}
                icon={Users}
              />
              {teamUsers.length === 0 ? (
                <EmptyState compact icon={Users} title="No team workload in this view" />
              ) : (
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                      <TableHead className="text-right">Due this week</TableHead>
                      <TableHead className="w-56">Today&apos;s load</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamUsers.map((member, index) => {
                      const load = Math.round(member.utilization * 100);
                      const tone = utilizationTone(load, member.overloaded);
                      return (
                        <TableRow key={member.userId}>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={cn(
                                  "w-4 shrink-0 text-center text-xs font-medium tabular",
                                  index < 3 ? "text-foreground" : "text-subtle-foreground",
                                )}
                              >
                                {index + 1}
                              </span>
                              <PersonAvatar name={member.name} size="sm" />
                              <span className="truncate font-medium text-foreground">
                                {member.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular">
                            {member.openTaskCount}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular">
                            {member.weekDeadlineCount}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Meter
                                className="h-2 flex-1"
                                value={load}
                                tone={tone}
                                danger={member.overloaded}
                                label={`${member.name} load ${load}%`}
                              />
                              <span
                                className={cn(
                                  "w-24 whitespace-nowrap text-right text-sm tabular",
                                  member.overloaded
                                    ? "font-medium text-danger-soft-foreground"
                                    : "text-muted-foreground",
                                )}
                                title={`${(member.utilization * hoursPerDay).toFixed(1)}h of ${hoursPerDay}h scheduled today`}
                              >
                                {load}%
                                <span className="ml-1.5 text-2xs font-normal text-subtle-foreground">
                                  {(member.utilization * hoursPerDay).toFixed(1)}h
                                </span>
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ListPanel>

            <div className="space-y-4 lg:col-span-2">
              <ChartCard title="By priority" description={`Live: all ${priorityTotal} tasks in scope, by priority.`}>
                {priorityTotal === 0 ? (
                  <EmptyState compact icon={BarChart3} title="No priority data" />
                ) : (
                  <BarList items={priorityItems} total={priorityTotal} />
                )}
              </ChartCard>

              <ChartCard
                title="My day"
                description={`Your My Day list for today, ${user.data?.name?.split(" ")[0] ?? "you"}. Not affected by report filters.`}
              >
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "On my list", value: myAssigned },
                    { label: "Done", value: myCompleted.length },
                    { label: "Due today", value: myOpen.length },
                    { label: "Overdue", value: myOverdue.length, danger: myOverdue.length > 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-muted/60 px-2.5 py-2">
                      <dd
                        className={cn(
                          "font-heading text-xl font-semibold tracking-[-0.02em] tabular",
                          item.danger ? "text-danger-soft-foreground" : "text-foreground",
                        )}
                      >
                        {item.value}
                      </dd>
                      <dt className="truncate text-2xs text-muted-foreground">{item.label}</dt>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Done today</span>
                    <span className="font-medium text-foreground tabular">{myRate}%</span>
                  </div>
                  <Progress
                    value={myRate}
                    tone={myRate >= 100 ? "success" : "primary"}
                    aria-label="My completion rate"
                  />
                </div>
                {dashboard.data ? (
                  <p className="mt-3 text-xs text-muted-foreground tabular">
                    All-time workspace totals: {dashboard.data.totals.completed} completed ·{" "}
                    {dashboard.data.totals.overdue} overdue
                  </p>
                ) : null}
              </ChartCard>
            </div>
          </div>

          <AiNarrativeCard from={from} to={to} />

          <ListPanel>
            <PanelHeader
              title="Attention required"
              description="Overdue, returned and awaiting review right now (not limited to the date range)."
              icon={AlertTriangle}
              action={attentionFilters}
            />
            {attention.length === 0 && dueSoon.length === 0 ? (
              <EmptyState compact icon={CheckCircle2} title="Nothing needs attention" />
            ) : (
              <>
                {attention.length ? (
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Task</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attention.map((task) => {
                        const people = (task.assignees ?? []).length
                          ? (task.assignees ?? [])
                          : task.assignee
                            ? [task.assignee]
                            : [];
                        const late =
                          task.status === "OVERDUE" ||
                          Boolean(
                            task.dueDate &&
                              task.status !== "COMPLETED" &&
                              task.dueDate.slice(0, 10) < today,
                          );
                        return (
                          <TableRow key={task.id}>
                            <TableCell className="max-w-72">
                              <Link
                                href={`/app/tasks/${task.id}`}
                                className="block truncate rounded-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {task.title}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {task.project?.name ?? "—"}
                            </TableCell>
                            <TableCell>
                              {people.length ? (
                                <div
                                  className="flex items-center gap-2"
                                  title={people.map((person) => person.name).join(", ")}
                                >
                                  <AvatarStack people={people} max={3} size="xs" />
                                  <span className="max-w-32 truncate text-sm text-muted-foreground">
                                    {people.length === 1
                                      ? people[0].name
                                      : `${people.length} people`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-subtle-foreground">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "whitespace-nowrap text-sm tabular",
                                late
                                  ? "font-medium text-danger-soft-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatDate(task.dueDate)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge value={task.status} />
                            </TableCell>
                            <TableCell>
                              <PriorityBadge value={task.priority} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : null}
                {dueSoon.length ? (
                  <div className="border-t border-border px-4 py-3 sm:px-5">
                    <p className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                      Due soon
                    </p>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {dueSoon.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-foreground">
                              {item.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular">
                              {formatDate(item.dueDate)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </ListPanel>

          <ListPanel>
            <PanelHeader
              title="Recent activity"
              description="Completions, submissions, assignments, and related changes."
              icon={Activity}
            />
            {recent.length === 0 ? (
              <EmptyState compact icon={Activity} title="No recent activity" />
            ) : (
              <ol className="divide-y divide-border">
                {recent.map((item) => {
                  const href = activityHref(item.entityType, item.entityId);
                  const body = (
                    <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <PersonAvatar name={item.actor?.name ?? "Someone"} size="sm" />
                      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {item.actor?.name ?? "Someone"}
                        </span>{" "}
                        {item.title}
                        {item.entityType === "task" && item.entityId && taskTitles.get(item.entityId) ? (
                          <>
                            {" "}
                            <span className="font-medium text-foreground">
                              “{taskTitles.get(item.entityId)}”
                            </span>
                          </>
                        ) : null}
                      </p>
                      <span className="shrink-0 text-xs text-subtle-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                  );
                  return (
                    <li key={item.id}>
                      {href ? (
                        <Link
                          href={href}
                          className="block transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
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
          </ListPanel>
        </>
      )}
    </PageShell>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "var(--danger)",
  HIGH: "var(--warning)",
  MEDIUM: "var(--info)",
  LOW: "var(--chart-6)",
};

/** Signed percentage for StatCard's `delta` prop. */
function deltaOf(change: { percent: number; up: boolean } | null) {
  if (!change) return null;
  return change.up ? change.percent : -change.percent;
}

function PanelHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: typeof Activity;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        ) : null}
        <div className="min-w-0">
          <h2 className="text-md font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Headline band: completion ring plus a plain-language summary built from the same numbers as the KPIs. */
function ReportSummary({
  from,
  to,
  scope,
  totalTasks,
  completed,
  completionRate,
  createdInRange,
  completedInRange,
  open,
  overdue,
  inReview,
  projectsWithWork,
  meetings,
  members,
  overloaded,
  teamLoad,
  todayHours,
  capacityHours,
}: {
  from: string;
  to: string;
  scope: string;
  totalTasks: number;
  completed: number;
  completionRate: number;
  createdInRange: number;
  completedInRange: number;
  open: number;
  overdue: number;
  inReview: number;
  projectsWithWork: number;
  meetings: number;
  members: number;
  overloaded: number;
  teamLoad: number;
  todayHours: number;
  capacityHours: number;
}) {
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const findings: Array<{ tone: "success" | "warning" | "danger" | "info"; text: string }> = [];
  findings.push({
    tone: "info",
    text: `In this range: ${plural(createdInRange, "task")} created, ${completedInRange} completed, ${plural(meetings, "meeting")}.`,
  });
  if (totalTasks === 0) {
    findings.push({ tone: "info", text: "There are no tasks in scope yet." });
  } else {
    findings.push({
      tone: completionRate >= 50 ? "success" : "info",
      text: `Right now: ${completed} of ${plural(totalTasks, "task")} done (${completionRate}%), ${open} still open.`,
    });
  }
  findings.push(
    overdue > 0
      ? { tone: "danger", text: `${plural(overdue, "task")} overdue and need attention.` }
      : { tone: "success", text: "Nothing is overdue." },
  );
  if (inReview > 0) {
    findings.push({ tone: "warning", text: `${plural(inReview, "task")} waiting for review.` });
  }
  findings.push(
    overloaded > 0
      ? {
          tone: "warning",
          text: `${overloaded} of ${plural(members, "person")} over capacity today.`.replace("persons", "people"),
        }
      : { tone: "success", text: "Everyone is within capacity today." },
  );

  const dot = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  } as const;

  return (
    <Surface className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-8">
      <div className="flex items-center gap-4">
        <ProgressRing value={completionRate} size={92} stroke={8}>
          <span className="font-heading text-lg font-semibold">{completionRate}%</span>
        </ProgressRing>
        <div>
          <p className="text-sm text-muted-foreground">Done right now</p>
          <p className="font-heading text-2xl font-semibold tracking-[-0.02em] tabular">
            {completed}
            <span className="text-lg text-subtle-foreground"> / {totalTasks}</span>
          </p>
          <p className="text-xs text-muted-foreground">of all tasks in scope</p>
        </div>
      </div>

      <div className="min-w-0 border-border lg:border-l lg:pl-8">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-subtle-foreground">
          Summary · {formatDate(from)} – {formatDate(to)}
          {scope ? ` · ${scope}` : ""}
        </p>
        <ul className="mt-2 space-y-1.5">
          {findings.map((item) => (
            <li key={item.text} className="flex items-start gap-2.5 text-base text-foreground">
              <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", dot[item.tone])} aria-hidden />
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <dl className="grid grid-cols-3 gap-2 lg:w-[300px] lg:grid-cols-1">
        {[
          { icon: FolderKanban, label: "Projects with tasks", value: String(projectsWithWork) },
          { icon: Users, label: "Team members", value: String(members) },
          {
            icon: Gauge,
            label: "Team load today",
            value: `${teamLoad}%`,
            detail: `${todayHours.toFixed(1)}h / ${capacityHours}h`,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex flex-col gap-1 rounded-lg bg-muted/60 px-3 py-2 lg:flex-row lg:items-center lg:gap-2.5"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <dt className="text-2xs text-muted-foreground lg:flex-1 lg:text-sm">{item.label}</dt>
              <dd className="font-medium text-foreground tabular">
                {item.value}
                {item.detail ? (
                  <span className="ml-1.5 text-2xs font-normal text-subtle-foreground">{item.detail}</span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </Surface>
  );
}

function KpiGroupLabel({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <h2 id={id} className="text-sm font-semibold text-foreground">
        {title}
      </h2>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Surface className={cn("flex flex-col", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-md font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </Surface>
  );
}

function ReportsSkeleton() {
  return (
    <div role="status" aria-label="Loading reports" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5 lg:col-span-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-6">
            <Skeleton className="size-40 rounded-full" />
            <div className="flex-1 space-y-2.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-3 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5 lg:col-span-3">
          <Skeleton className="h-4 w-28" />
          <div className="flex h-48 items-end gap-2">
            {[40, 65, 30, 80, 55, 70, 45, 90, 60, 35].map((height, index) => (
              <Skeleton
                key={index}
                className="flex-1 rounded-b-none"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
