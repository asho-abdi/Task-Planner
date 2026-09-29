"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  FolderKanban,
  MapPin,
  MoreHorizontal,
  Play,
  Plus,
  Sun,
  Video,
} from "lucide-react";
import { ListPanel, PageShell } from "@/components/page-header";
import { MemberAvatarGroup } from "@/components/member-avatar-group";
import { PriorityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useMyDay } from "@/features/insights/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import { useStartTask } from "@/features/tasks/hooks";
import type { InsightMeeting, InsightTask } from "@/features/insights/types";
import { cn, formatDate, formatTime, localDateYmd } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

function greeting(name: string) {
  const hour = new Date().getHours();
  const hello =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${hello}, ${name}`;
}

function canStartTask(status: string) {
  return status === "TODO" || status === "RETURNED" || status === "OVERDUE";
}

function dueTime(task: InsightTask) {
  const value = task.scheduledStart ?? task.dueDate;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) return null;
  return formatTime(value);
}

function meetingPlace(meeting: InsightMeeting) {
  if (meeting.mode === "ONLINE" || meeting.meetingLink) return "Online";
  return meeting.location?.trim() || "In person";
}

function useStartWithToast() {
  const start = useStartTask();
  const run = (taskId: string) =>
    void start
      .mutateAsync(taskId)
      .then(() => toast.success("Task started"))
      .catch(() => undefined);
  return { run, isPending: start.isPending };
}

type Tone = "overdue" | "today" | "upcoming" | "completed";

function TaskMenu({ task }: { task: InsightTask }) {
  const start = useStartWithToast();
  const startable = canStartTask(task.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${task.title}`}
          className="flex size-7 items-center justify-center rounded-md text-subtle-foreground opacity-100 transition-[opacity,colors] duration-150 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/app/tasks/${task.id}`}>
            <ExternalLink />
            Open task
          </Link>
        </DropdownMenuItem>
        {startable ? (
          <DropdownMenuItem
            disabled={start.isPending}
            onSelect={() => start.run(task.id)}
          >
            <Play />
            Start work
          </DropdownMenuItem>
        ) : null}
        {task.project ? (
          <DropdownMenuItem asChild>
            <Link href={`/app/projects/${task.project.id}`}>
              <FolderKanban />
              View project
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskStatusControl({ task }: { task: InsightTask }) {
  const start = useStartWithToast();
  const startable = canStartTask(task.status);
  const done = task.status === "COMPLETED";
  const className = cn(
    "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    done
      ? "border-success bg-success text-primary-foreground"
      : startable
        ? "border-border-strong bg-card hover:border-primary hover:bg-primary-soft"
        : "border-primary bg-primary-soft",
  );

  if (done) {
    return (
      <span aria-label={`${task.title} completed`} className={className}>
        <Check className="size-2.5" strokeWidth={3} />
      </span>
    );
  }

  if (!startable) {
    return (
      <Tooltip content="In progress — open task">
        <Link
          href={`/app/tasks/${task.id}`}
          aria-label={`Open ${task.title}`}
          className={className}
        >
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="sr-only">Open task</span>
        </Link>
      </Tooltip>
    );
  }

  return (
    <Tooltip content="Start work">
      <button
        type="button"
        aria-label={`Start work on ${task.title}`}
        disabled={start.isPending}
        onClick={() => start.run(task.id)}
        className={cn(className, start.isPending && "animate-pulse")}
      />
    </Tooltip>
  );
}

function TaskRow({ task, tone = "today" }: { task: InsightTask; tone?: Tone }) {
  const people = task.assignees?.length
    ? task.assignees
    : task.assignee
      ? [task.assignee]
      : [];
  const time = dueTime(task);
  const startable = canStartTask(task.status);
  const start = useStartWithToast();

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/50 sm:px-5",
      )}
    >
      <TaskStatusControl task={task} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/app/tasks/${task.id}`}
          className={cn(
            "block truncate rounded-sm text-base font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone === "completed" && "font-normal text-muted-foreground line-through",
          )}
        >
          {task.title}
        </Link>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          {tone === "overdue" ? (
            <span className="shrink-0 font-medium text-danger-soft-foreground">
              Overdue{task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}
            </span>
          ) : tone === "upcoming" && task.dueDate ? (
            <span className="shrink-0">Due {formatDate(task.dueDate)}</span>
          ) : null}
          {tone === "overdue" || (tone === "upcoming" && task.dueDate) ? (
            <span aria-hidden className="text-subtle-foreground">·</span>
          ) : null}
          <span className="truncate">{task.project?.name ?? "No project"}</span>
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {tone === "today" && time ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
            <Clock className="size-3" />
            {time}
          </span>
        ) : null}
        {task.priority && tone !== "completed" ? (
          <PriorityBadge value={task.priority} />
        ) : null}
        {people.length ? <MemberAvatarGroup people={people} limit={2} /> : null}
      </div>
      {tone !== "completed" && startable ? (
        <Button
          size="xs"
          variant="outline"
          className="hidden sm:group-hover:inline-flex"
          loading={start.isPending}
          onClick={() => start.run(task.id)}
        >
          <Play />
          Start
        </Button>
      ) : null}
      {tone === "completed" ? null : <TaskMenu task={task} />}
    </div>
  );
}

function TaskSection({
  title,
  count,
  children,
  collapsible = false,
  icon,
  tone,
}: {
  title: string;
  count: number;
  children: ReactNode;
  collapsible?: boolean;
  icon?: ReactNode;
  tone?: "danger" | "default";
}) {
  const [open, setOpen] = useState(!collapsible);
  if (count === 0) return null;

  const heading = (
    <span className="flex items-center gap-2">
      {collapsible ? (
        <ChevronRight
          className={cn(
            "size-3.5 text-subtle-foreground transition-transform duration-150",
            open && "rotate-90",
          )}
        />
      ) : (
        icon
      )}
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.08em]",
          tone === "danger" ? "text-danger-soft-foreground" : "text-muted-foreground",
        )}
      >
        {title}
      </span>
      <span className="rounded-full bg-muted px-1.5 text-2xs font-medium text-muted-foreground tabular">
        {count}
      </span>
    </span>
  );

  return (
    <section>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full items-center bg-muted/40 px-4 py-2 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
          onClick={() => setOpen((value) => !value)}
        >
          {heading}
        </button>
      ) : (
        <div className="bg-muted/40 px-4 py-2 sm:px-5">{heading}</div>
      )}
      {open ? (
        <div className="divide-y divide-border border-t border-border animate-fade-in">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function MeetingRow({
  meeting,
  last,
  now,
}: {
  meeting: InsightMeeting;
  last: boolean;
  now: number;
}) {
  const context = meeting.project?.name ?? meeting.team?.name ?? null;
  const place = meetingPlace(meeting);
  const online = place === "Online";

  const live =
    new Date(meeting.startAt).getTime() <= now &&
    (!meeting.endAt || new Date(meeting.endAt).getTime() >= now);

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last ? (
        <span
          aria-hidden
          className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-border"
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          "relative mt-1 size-[11px] shrink-0 rounded-full border-2 border-card ring-1",
          live ? "bg-success ring-success" : "bg-primary ring-primary",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular">
          {formatTime(meeting.startAt)}
          {meeting.endAt ? ` – ${formatTime(meeting.endAt)}` : ""}
          {live ? (
            <span className="rounded-full bg-success-soft px-1.5 text-2xs font-medium text-success-soft-foreground">
              Now
            </span>
          ) : null}
        </p>
        <Link
          href={`/app/meetings/${meeting.id}`}
          className="mt-0.5 block truncate rounded-sm text-base font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {meeting.title}
        </Link>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          {online ? (
            <Video className="size-3 shrink-0" />
          ) : (
            <MapPin className="size-3 shrink-0" />
          )}
          <span className="truncate">
            {context ? `${context} · ` : ""}
            {place}
          </span>
        </p>
        <div className="mt-2">
          {online && meeting.meetingLink ? (
            <Button asChild size="xs" variant="soft">
              <a href={meeting.meetingLink} target="_blank" rel="noreferrer">
                <Video />
                Join
              </a>
            </Button>
          ) : (
            <Button asChild size="xs" variant="ghost" className="-ml-2">
              <Link href={`/app/meetings/${meeting.id}`}>View details</Link>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function SummaryPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm",
        tone === "danger" && value > 0
          ? "border-danger/25 bg-danger-soft text-danger-soft-foreground"
          : tone === "success" && value > 0
            ? "border-success/25 bg-success-soft text-success-soft-foreground"
            : "border-border bg-card text-muted-foreground",
      )}
    >
      <span className="font-semibold text-foreground tabular">{value}</span>
      {label}
    </span>
  );
}

function MyDaySkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="bg-muted/40 px-5 py-2.5">
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="divide-y divide-border border-t border-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="size-[18px] rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
              <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
              <Skeleton className="hidden size-6 rounded-full sm:block" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="mt-1 size-[11px] rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyDayPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const user = useCurrentUser();
  const date = localDateYmd();
  const myDay = useMyDay(workspaceId, date);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const firstName = user.data?.name?.split(" ")[0] ?? "there";
  const now = new Date();

  const groups = useMemo(() => {
    const overdue = myDay.data?.overdueTasks?.items ?? [];
    const overdueIds = new Set(overdue.map((task) => task.id));
    const today = (myDay.data?.todayTasks.items ?? []).filter(
      (task) => !overdueIds.has(task.id) && task.status !== "COMPLETED",
    );
    const todayIds = new Set(today.map((task) => task.id));
    const upcoming = (myDay.data?.upcomingDeadlines?.items ?? []).filter(
      (task) =>
        !overdueIds.has(task.id) &&
        !todayIds.has(task.id) &&
        task.status !== "COMPLETED",
    );
    const completed = myDay.data?.completedTasks?.items ?? [];
    return { overdue, today, upcoming, completed };
  }, [myDay.data]);

  const meetings = myDay.data?.meetings.items ?? [];
  const openCount = groups.overdue.length + groups.today.length;
  const totalCount = openCount + groups.completed.length;
  const hasWork = totalCount + groups.upcoming.length > 0;
  const progress = totalCount
    ? Math.round((groups.completed.length / totalCount) * 100)
    : 0;

  return (
    <PageShell className="max-w-[1120px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div
            aria-hidden
            className="flex h-16 w-14 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-center shadow-xs"
          >
            <span className="bg-primary py-0.5 text-2xs font-semibold uppercase tracking-[0.1em] text-primary-foreground">
              {now.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="flex flex-1 items-center justify-center font-heading text-2xl font-semibold leading-none tracking-[-0.03em] text-foreground tabular">
              {now.getDate()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="mt-0.5 truncate font-heading text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-3xl">
              {greeting(firstName)}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpenCreateDialog("meeting")}
          >
            <CalendarPlus />
            Meeting
          </Button>
          <Button size="sm" onClick={() => openTaskCreate()}>
            <Plus />
            Task
          </Button>
        </div>
      </header>

      {myDay.data ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <SummaryPill label="open" value={openCount} />
            <SummaryPill label="overdue" value={groups.overdue.length} tone="danger" />
            <SummaryPill
              label={meetings.length === 1 ? "meeting" : "meetings"}
              value={meetings.length}
            />
            <SummaryPill label="done" value={groups.completed.length} tone="success" />
          </div>
          {totalCount > 0 ? (
            <div className="flex items-center gap-3 sm:w-56">
              <Progress
                value={progress}
                tone="success"
                size="sm"
                className="flex-1"
                aria-label="Today's progress"
              />
              <span className="text-xs font-medium text-muted-foreground tabular">
                {progress}%
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {myDay.isLoading ? (
        <MyDaySkeleton />
      ) : myDay.isError ? (
        <ErrorState
          title="Couldn't load My Day"
          description={myDay.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void myDay.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !myDay.data ? (
        <EmptyState icon={Sun} title="Unable to load My Day" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ListPanel>
            {!hasWork ? (
              <EmptyState
                icon={Sun}
                title="Clear day"
                description="Nothing is assigned for today. Enjoy the focus time."
                action={
                  <Button size="sm" onClick={() => openTaskCreate()}>
                    <Plus />
                    Add a task
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                <TaskSection
                  title="Overdue"
                  count={groups.overdue.length}
                  tone="danger"
                  icon={<AlertTriangle className="size-3.5 text-danger-soft-foreground" />}
                >
                  {groups.overdue.map((task) => (
                    <TaskRow key={task.id} task={task} tone="overdue" />
                  ))}
                </TaskSection>
                <TaskSection
                  title="Today"
                  count={groups.today.length}
                  icon={<Sun className="size-3.5 text-warning" />}
                >
                  {groups.today.map((task) => (
                    <TaskRow key={task.id} task={task} tone="today" />
                  ))}
                </TaskSection>
                {openCount === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                    <Check className="size-4 text-success" />
                    Nothing left for today.
                  </div>
                ) : null}
                <TaskSection
                  title="Upcoming"
                  count={groups.upcoming.length}
                  icon={<CalendarClock className="size-3.5 text-info" />}
                >
                  {groups.upcoming.map((task) => (
                    <TaskRow key={task.id} task={task} tone="upcoming" />
                  ))}
                </TaskSection>
                <TaskSection
                  title="Done"
                  count={groups.completed.length}
                  collapsible
                >
                  {groups.completed.map((task) => (
                    <TaskRow key={task.id} task={task} tone="completed" />
                  ))}
                </TaskSection>
              </div>
            )}
          </ListPanel>

          <aside className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-md font-semibold tracking-[-0.01em] text-foreground">
                <CalendarClock className="size-4 text-muted-foreground" />
                Schedule
              </h2>
              <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground tabular">
                {meetings.length}
              </span>
            </div>
            {meetings.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarClock}
                title="No meetings today"
                description="Your calendar is clear."
                action={
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setOpenCreateDialog("meeting")}
                  >
                    <CalendarPlus />
                    Schedule one
                  </Button>
                }
              />
            ) : (
              <ol className="mt-4">
                {meetings.map((meeting, index) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    last={index === meetings.length - 1}
                    now={now.getTime()}
                  />
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  );
}
