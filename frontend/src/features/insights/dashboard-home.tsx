"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Plus,
  Search,
  Video,
} from "lucide-react";
import { MemberAvatarGroup, PersonAvatar } from "@/components/member-avatar-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Meter } from "@/features/insights/ui";
import { useDashboard, useMyDay } from "@/features/insights/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import { useMutateTask, useStartTask } from "@/features/tasks/hooks";
import { useProjects } from "@/features/projects/hooks";
import {
  useCurrentWorkspace,
  useWorkspaceMembers,
} from "@/features/workspaces/hooks";
import { activityHref } from "@/features/chat/types";
import {
  cn,
  formatDate,
  formatRelativeTime,
  formatTime,
  fromDateInputValue,
  localDateYmd,
  nativeSelectClass,
  toDateInputValue,
} from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  DashboardMeeting,
  DashboardTask,
  InsightTask,
} from "@/features/insights/types";

type WorkTab = "today" | "upcoming" | "completed";

function firstNameOf(name?: string | null) {
  return name?.split(" ")[0] ?? "there";
}

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return formatDate(value);
  }
  return `${formatDate(value)} · ${formatTime(value)}`;
}

function meetingPlace(meeting: DashboardMeeting) {
  if (meeting.mode === "ONLINE" || meeting.meetingLink) return "Online";
  return "Offline";
}

function priorityDot(priority?: string) {
  if (priority === "URGENT" || priority === "CRITICAL") return "bg-[#EF4444]";
  if (priority === "HIGH") return "bg-[#F59E0B]";
  if (priority === "MEDIUM") return "bg-primary";
  return "bg-[#94A3B8]";
}

function canStartTask(status: string) {
  return status === "TODO" || status === "RETURNED" || status === "OVERDUE";
}

function resourceLabel(entityType: string | null) {
  if (entityType === "task") return "Task";
  if (entityType === "project") return "Project";
  if (entityType === "meeting") return "Meeting";
  if (entityType === "file") return "File";
  if (entityType === "conversation") return "Chat";
  return entityType ?? "Workspace";
}

export function DashboardHome() {
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const user = useCurrentUser();
  const workspace = useCurrentWorkspace();
  const dashboard = useDashboard(workspaceId);
  const myDay = useMyDay(workspaceId, localDateYmd());
  const projects = useProjects(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const openMeetingCreate = useUiStore((state) => state.openMeetingCreate);
  const [query, setQuery] = useState("");
  const [workTab, setWorkTab] = useState<WorkTab>("today");
  const [activityOpen, setActivityOpen] = useState(false);
  const firstName = firstNameOf(user.data?.name);
  const canWrite = Boolean(workspace && workspace.role !== "VIEWER");
  const data = dashboard.data;

  const todayTasks = useMemo(
    () => myDay.data?.todayTasks.items ?? data?.myDay?.items ?? [],
    [myDay.data?.todayTasks.items, data?.myDay?.items],
  );
  const upcomingTasks = myDay.data?.upcomingDeadlines?.items ?? [];
  const completedTasks = myDay.data?.completedTasks?.items ?? [];
  const workLists: Record<WorkTab, InsightTask[] | DashboardTask[]> = {
    today: todayTasks,
    upcoming: upcomingTasks,
    completed: completedTasks,
  };

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { tasks: [], projects: [], people: [] };
    return {
      tasks: (data?.myDay?.items ?? todayTasks)
        .filter((item) => item.title.toLowerCase().includes(q))
        .slice(0, 4),
      projects: (projects.data ?? [])
        .filter((item) => item.name.toLowerCase().includes(q))
        .slice(0, 4),
      people: (members.data ?? [])
        .filter((item) => item.user.name.toLowerCase().includes(q))
        .slice(0, 4),
    };
  }, [query, data?.myDay?.items, todayTasks, projects.data, members.data]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/app/tasks?q=${encodeURIComponent(q)}` : "/app/tasks");
  }

  const myTasks = data?.totals.myTasks ?? data?.totals.total ?? 0;
  const meetingsCount =
    data?.totals.upcomingMeetings ?? data?.upcomingMeetings.total ?? 0;
  const activeProjects = data?.activeProjects ?? data?.projectProgress ?? [];
  const meetings = (data?.upcomingMeetings.items ?? []).slice(0, 5);
  const deadlines = (data?.upcomingDeadlines ?? []).slice(0, 5);
  const activity = (data?.recentActivity ?? []).slice(0, 6);

  const activityPanel = (
    <ActivityPanel
      loading={dashboard.isLoading}
      error={dashboard.isError ? dashboard.error.message : null}
      meetings={meetings}
      deadlines={deadlines}
      activity={activity}
      currentUserId={user.data?.id}
    />
  );

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100svh-5.5rem)] flex-col xl:-mx-8 xl:-my-8 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-5 px-4 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-[#172033]">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Welcome back, {firstName}. Here&apos;s what needs your attention.
            </p>
          </div>
          <form
            className="relative w-full min-w-0 lg:max-w-sm"
            onSubmit={submitSearch}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks, projects, people..."
              className="h-10 rounded-xl border-[#E5E7EB] bg-white pl-9"
              aria-label="Search tasks, projects, people"
            />
            {query.trim().length >= 2 &&
            (searchHits.tasks.length ||
              searchHits.projects.length ||
              searchHits.people.length) ? (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-[var(--shadow-soft)]">
                {searchHits.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/app/tasks/${task.id}`}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-[#F8FAFC]"
                  >
                    {task.title}
                    <span className="ml-2 text-xs text-[#64748B]">Task</span>
                  </Link>
                ))}
                {searchHits.projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-[#F8FAFC]"
                  >
                    {project.name}
                    <span className="ml-2 text-xs text-[#64748B]">Project</span>
                  </Link>
                ))}
                {searchHits.people.map((member) => (
                  <Link
                    key={member.userId}
                    href="/app/teams"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-[#F8FAFC]"
                  >
                    {member.user.name}
                    <span className="ml-2 text-xs text-[#64748B]">Person</span>
                  </Link>
                ))}
                <button
                  type="submit"
                  className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-[#EEF2FF]"
                >
                  Search tasks for “{query.trim()}”
                </button>
              </div>
            ) : null}
          </form>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-[#172033]">
              Welcome back, {firstName} 👋
            </p>
            <p className="mt-0.5 text-sm text-[#64748B]">
              Here&apos;s what&apos;s happening with your work today.
            </p>
          </div>
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openTaskCreate()}>
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openMeetingCreate()}
              >
                <CalendarDays className="h-4 w-4" />
                Schedule Meeting
              </Button>
            </div>
          ) : null}
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dashboard.isLoading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : dashboard.isError ? (
            <p className="col-span-full text-sm text-destructive">
              {dashboard.error.message}
            </p>
          ) : (
            <>
              <SummaryCard
                href="/app/tasks"
                label="My Tasks"
                value={myTasks}
                hint="Open work assigned to you"
                icon={CheckSquare}
              />
              <SummaryCard
                href="/app/tasks"
                label="Completed"
                value={data?.totals.completed ?? 0}
                hint="Finished in this workspace"
                icon={CheckCircle2}
                tone="success"
              />
              <SummaryCard
                href="/app/my-day"
                label="Overdue"
                value={data?.totals.overdue ?? 0}
                hint="Needs attention"
                icon={AlertTriangle}
                tone="danger"
              />
              <SummaryCard
                href="/app/meetings"
                label="Upcoming Meetings"
                value={meetingsCount}
                hint="Scheduled this week"
                icon={CalendarDays}
              />
            </>
          )}
        </div>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#172033]">My Work</h2>
              <p className="text-sm text-[#64748B]">
                Today, upcoming, and recently finished tasks
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/my-day">Open My Day</Link>
            </Button>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] px-3 py-2">
            {(
              [
                ["today", "Today's Tasks", todayTasks.length],
                ["upcoming", "Upcoming Tasks", upcomingTasks.length],
                ["completed", "Recently Completed", completedTasks.length],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWorkTab(id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  workTab === id
                    ? "bg-[#EEF2FF] text-primary"
                    : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033]",
                )}
              >
                {label}
                <span className="ml-1.5 text-xs text-[#94A3B8]">{count}</span>
              </button>
            ))}
          </div>
          {dashboard.isLoading && myDay.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : workLists[workTab].length === 0 ? (
            <p className="px-5 py-8 text-sm text-[#64748B]">
              {workTab === "today"
                ? "No tasks assigned yet"
                : workTab === "upcoming"
                  ? "No upcoming tasks"
                  : "No recently completed work"}
            </p>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {workLists[workTab].map((task) => (
                <WorkRow
                  key={task.id}
                  task={task}
                  completed={workTab === "completed"}
                  canWrite={canWrite}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#172033]">
              Active Projects
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/projects">View all</Link>
            </Button>
          </div>
          {dashboard.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ) : activeProjects.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-5 py-8 text-sm text-[#64748B]">
              No active projects yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeProjects.map((project) => (
                <Link
                  key={project.projectId}
                  href={`/app/projects/${project.projectId}`}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-medium text-[#172033]">
                      {project.name}
                    </p>
                    {project.status ? (
                      <StatusBadge value={project.status} />
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#64748B]">
                    <span>Progress</span>
                    <span className="font-medium text-[#172033]">
                      {project.percent}%
                    </span>
                  </div>
                  <Meter className="mt-1.5" value={project.percent} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <MemberAvatarGroup people={project.members ?? []} />
                    <span className="text-xs text-[#64748B]">
                      {project.dueDate
                        ? `Due ${formatDate(project.dueDate)}`
                        : "No due date"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {data?.teamWorkload.length ? (
          <section className="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#172033]">
                Team workload
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/workload">View Workload</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.teamWorkload.slice(0, 4).map((person) => {
                const percent = Math.min(
                  100,
                  Math.round(person.utilization * 100),
                );
                return (
                  <div key={person.userId}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <PersonAvatar name={person.name} size="sm" />
                        <span className="truncate font-medium text-[#172033]">
                          {person.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          person.overloaded
                            ? "text-[#EF4444]"
                            : "text-[#64748B]",
                        )}
                      >
                        {percent}%
                      </span>
                    </div>
                    <Meter value={percent} danger={person.overloaded} />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="xl:hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 text-left"
            onClick={() => setActivityOpen((open) => !open)}
            aria-expanded={activityOpen}
          >
            <div>
              <p className="text-base font-semibold text-[#172033]">
                My Activity
              </p>
              <p className="text-sm text-[#64748B]">
                Meetings, deadlines, and recent updates
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-[#64748B] transition-transform",
                activityOpen && "rotate-180",
              )}
            />
          </button>
          {activityOpen ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
              {activityPanel}
            </div>
          ) : null}
        </section>
      </div>

      <aside className="hidden w-[320px] shrink-0 border-l border-[#E5E7EB] bg-white xl:flex xl:flex-col">
        <div className="sticky top-0 max-h-[calc(100svh-4.5rem)] overflow-y-auto">
          {activityPanel}
        </div>
      </aside>
    </div>
  );
}

function SummaryCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: typeof CheckSquare;
  tone?: "success" | "danger";
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/35"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[#64748B]">{label}</p>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "success" && "bg-emerald-50 text-[#16A34A]",
            tone === "danger" && "bg-red-50 text-[#EF4444]",
            !tone && "bg-[#EEF2FF] text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-[26px] font-semibold tracking-tight text-[#172033]",
          tone === "success" && "text-[#16A34A]",
          tone === "danger" && value > 0 && "text-[#EF4444]",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[#64748B]">{hint}</p>
    </Link>
  );
}

function WorkRow({
  task,
  completed,
  canWrite,
}: {
  task: InsightTask | DashboardTask;
  completed: boolean;
  canWrite: boolean;
}) {
  const start = useStartTask();
  const mutate = useMutateTask();
  const canStart = canWrite && !completed && canStartTask(task.status);
  const assignee =
    ("assignee" in task ? task.assignee : null) ?? task.assignees?.[0] ?? null;

  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          aria-label={
            completed
              ? "Completed"
              : canStart
                ? "Start work"
                : "Task in progress"
          }
          disabled={!canStart || start.isPending}
          onClick={() => {
            if (canStart) void start.mutateAsync(task.id);
          }}
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            completed
              ? "border-[#16A34A] bg-[#16A34A] text-white"
              : canStart
                ? "border-[#CBD5E1] bg-white hover:border-primary"
                : "border-primary bg-primary/10",
          )}
        >
          {completed ? (
            <span className="h-2 w-2 rounded-[1px] bg-white" />
          ) : null}
        </button>
        <div className="min-w-0">
          <Link
            href={`/app/tasks/${task.id}`}
            className={cn(
              "font-medium hover:text-primary",
              completed
                ? "text-[#64748B] line-through"
                : "text-[#172033]",
            )}
          >
            {task.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            <span className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  priorityDot(task.priority),
                )}
              />
              {task.priority.replaceAll("_", " ").toLowerCase()}
            </span>
            <span>{task.project?.name ?? "No project"}</span>
            <span>{dueLabel(task.dueDate)}</span>
            {assignee ? <span>{assignee.name}</span> : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {canStart ? (
          <Button
            size="sm"
            onClick={() => void start.mutateAsync(task.id)}
            disabled={start.isPending}
          >
            Start work
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost">
          <Link href={`/app/tasks/${task.id}`}>Open</Link>
        </Button>
        {canWrite && !completed ? (
          <label className="flex items-center gap-1.5 text-xs text-[#64748B]">
            Reschedule
            <input
              type="date"
              aria-label="Reschedule"
              className={cn(nativeSelectClass, "h-8 w-[132px] text-xs")}
              value={toDateInputValue(task.dueDate)}
              onChange={(event) =>
                void mutate.mutateAsync({
                  taskId: task.id,
                  input: {
                    dueDate: fromDateInputValue(event.target.value) ?? null,
                  },
                })
              }
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function ActivityPanel({
  loading,
  error,
  meetings,
  deadlines,
  activity,
  currentUserId,
}: {
  loading: boolean;
  error: string | null;
  meetings: DashboardMeeting[];
  deadlines: NonNullable<
    NonNullable<ReturnType<typeof useDashboard>["data"]>["upcomingDeadlines"]
  >;
  activity: NonNullable<
    NonNullable<ReturnType<typeof useDashboard>["data"]>["recentActivity"]
  >;
  currentUserId?: string;
}) {
  return (
    <div className="space-y-6 px-5 py-6">
      <div>
        <h2 className="text-base font-semibold text-[#172033]">My Activity</h2>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Meetings, deadlines, and updates
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ActivitySection
        title="Upcoming Meetings"
        action={
          <Link href="/app/meetings" className="text-xs text-primary">
            View
          </Link>
        }
      >
        {loading ? (
          <Skeleton className="h-24" />
        ) : meetings.length === 0 ? (
          <p className="text-sm text-[#64748B]">No upcoming meetings</p>
        ) : (
          <ul className="space-y-3">
            {meetings.map((meeting) => (
              <li key={meeting.id}>
                <Link
                  href={`/app/meetings/${meeting.id}`}
                  className="block rounded-xl hover:bg-[#F8FAFC]"
                >
                  <div className="flex items-start gap-3 px-1 py-1">
                    <div className="w-[58px] shrink-0">
                      <p className="text-[11px] text-[#64748B]">
                        {formatDate(meeting.startAt)}
                      </p>
                      <p className="text-sm font-semibold text-[#172033]">
                        {formatTime(meeting.startAt)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#172033]">
                        {meeting.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#64748B]">
                        {meeting.project?.name ??
                          meeting.team?.name ??
                          "No project"}
                      </p>
                      <span
                        className={cn(
                          "mt-1 inline-flex items-center gap-1 text-[11px] font-medium",
                          meetingPlace(meeting) === "Online"
                            ? "text-primary"
                            : "text-[#64748B]",
                        )}
                      >
                        {meetingPlace(meeting) === "Online" ? (
                          <Video className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {meetingPlace(meeting)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ActivitySection>

      <ActivitySection
        title="Upcoming Deadlines"
        action={
          <Link href="/app/calendar" className="text-xs text-primary">
            View
          </Link>
        }
      >
        {loading ? (
          <Skeleton className="h-20" />
        ) : deadlines.length === 0 ? (
          <p className="text-sm text-[#64748B]">No upcoming deadlines</p>
        ) : (
          <ul className="space-y-3">
            {deadlines.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-xl px-1 py-1 hover:bg-[#F8FAFC]"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          item.kind === "task"
                            ? "bg-primary"
                            : item.kind === "milestone"
                              ? "bg-[#F59E0B]"
                              : "bg-[#64748B]",
                        )}
                      />
                      <span className="truncate text-sm font-medium text-[#172033]">
                        {item.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#64748B]">
                      {item.meta}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[#64748B]">
                    {formatDate(item.dueDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ActivitySection>

      <ActivitySection
        title="Recent Activity"
        action={
          <Link href="/app/activity" className="text-xs text-primary">
            View all
          </Link>
        }
      >
        {loading ? (
          <Skeleton className="h-24" />
        ) : activity.length === 0 ? (
          <p className="text-sm text-[#64748B]">No recent activity</p>
        ) : (
          <ol className="space-y-3">
            {activity.map((item) => {
              const href = activityHref(item.entityType, item.entityId);
              const actorName = item.actor?.name ?? "Someone";
              const actor =
                item.actor?.id && item.actor.id === currentUserId
                  ? "You"
                  : actorName;
              const body = (
                <div className="flex items-start gap-2.5">
                  <PersonAvatar name={actorName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm leading-5 text-[#172033]">
                      <span className="font-medium">{actor}</span> {item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      {resourceLabel(item.entityType)} ·{" "}
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={item.id}>
                  {href ? (
                    <Link href={href} className="block hover:opacity-80">
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
      </ActivitySection>
    </div>
  );
}

function ActivitySection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
