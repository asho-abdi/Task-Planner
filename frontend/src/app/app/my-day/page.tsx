"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarPlus, Check, MoreHorizontal, Plus } from "lucide-react";
import { EmptyState, PageShell } from "@/components/page-header";
import { MemberAvatarGroup } from "@/components/member-avatar-group";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";
import { Meter } from "@/features/insights/ui";
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

function todayLabel(value = new Date()) {
  return value.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  return "Offline";
}

function TaskMenu({ task }: { task: InsightTask }) {
  const [open, setOpen] = useState(false);
  const start = useStartTask();
  const ref = useRef<HTMLDivElement>(null);
  const startable = canStartTask(task.status);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Actions for ${task.title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="h-8 w-8 text-[#64748B]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        >
          <Link
            role="menuitem"
            href={`/app/tasks/${task.id}`}
            className="block px-3 py-2 text-sm text-[#172033] hover:bg-[#F8FAFC]"
            onClick={() => setOpen(false)}
          >
            Open task
          </Link>
          {startable ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-[#172033] hover:bg-[#F8FAFC]"
              disabled={start.isPending}
              onClick={() => {
                setOpen(false);
                void start.mutateAsync(task.id);
              }}
            >
              Start work
            </button>
          ) : null}
          {task.project ? (
            <Link
              role="menuitem"
              href={`/app/projects/${task.project.id}`}
              className="block px-3 py-2 text-sm text-[#172033] hover:bg-[#F8FAFC]"
              onClick={() => setOpen(false)}
            >
              View project
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TaskStatusControl({ task }: { task: InsightTask }) {
  const start = useStartTask();
  const startable = canStartTask(task.status);
  const done = task.status === "COMPLETED";
  const className = cn(
    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    done
      ? "border-primary bg-primary text-white"
      : startable
        ? "border-[#CBD5E1] bg-white hover:border-primary"
        : "border-primary bg-primary/15 text-primary",
  );

  if (done) {
    return (
      <span aria-label={`${task.title} completed`} className={className}>
        <Check className="h-3 w-3" />
      </span>
    );
  }

  if (!startable) {
    return (
      <Link
        href={`/app/tasks/${task.id}`}
        aria-label={`Open ${task.title}`}
        className={className}
      >
        <span className="sr-only">Open task</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Start work on ${task.title}`}
      disabled={start.isPending}
      onClick={() => void start.mutateAsync(task.id)}
      className={className}
    />
  );
}

function TaskRow({
  task,
  tone = "today",
}: {
  task: InsightTask;
  tone?: "overdue" | "today" | "completed";
}) {
  const people = task.assignees?.length
    ? task.assignees
    : task.assignee
      ? [task.assignee]
      : [];
  const time = dueTime(task);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3",
        tone === "completed" && "opacity-60",
      )}
    >
      <TaskStatusControl task={task} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/app/tasks/${task.id}`}
            className={cn(
              "font-medium text-[#172033] hover:text-primary",
              tone === "completed" && "text-[#64748B] line-through",
            )}
          >
            {task.title}
          </Link>
          {tone === "completed" ? null : <TaskMenu task={task} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748B]">
          {tone === "overdue" ? (
            <span className="font-medium text-[#EF4444]">Overdue</span>
          ) : null}
          <span>{task.project?.name ?? "No project"}</span>
          <StatusBadge value={task.priority} />
          {tone === "overdue" ? (
            <span>{formatDate(task.dueDate)}</span>
          ) : time ? (
            <span>{time}</span>
          ) : null}
          {people.length ? <MemberAvatarGroup people={people} limit={3} /> : null}
        </div>
      </div>
    </div>
  );
}

function TaskGroup({
  title,
  count,
  empty,
  children,
  collapsible = false,
}: {
  title: string;
  count: number;
  empty?: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible || count <= 4);
  if (count === 0 && !empty) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          {title}
          <span className="ml-2 font-medium text-[#94A3B8]">{count}</span>
        </h3>
        {collapsible && count > 4 ? (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="px-1 text-sm text-[#64748B]">{empty}</p>
      ) : open ? (
        <div className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          {children}
        </div>
      ) : (
        <p className="px-1 text-sm text-[#64748B]">{count} completed tasks hidden.</p>
      )}
    </section>
  );
}

function MeetingRow({ meeting }: { meeting: InsightMeeting }) {
  const context = meeting.project?.name ?? meeting.team?.name ?? null;
  const online = meetingPlace(meeting) === "Online";

  return (
    <div className="flex items-start gap-3 py-3">
      <p className="w-14 shrink-0 pt-0.5 text-sm font-semibold text-[#172033]">
        {formatTime(meeting.startAt)}
      </p>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[#172033]">{meeting.title}</p>
        <p className="mt-0.5 text-xs text-[#64748B]">
          {context ? `${context} · ` : ""}
          {meetingPlace(meeting)}
        </p>
      </div>
      {online && meeting.meetingLink ? (
        <Button asChild size="sm">
          <a href={meeting.meetingLink} target="_blank" rel="noreferrer">
            Join
          </a>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href={`/app/meetings/${meeting.id}`}>View</Link>
        </Button>
      )}
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

  const groups = useMemo(() => {
    const overdue = myDay.data?.overdueTasks?.items ?? [];
    const overdueIds = new Set(overdue.map((task) => task.id));
    const today = (myDay.data?.todayTasks.items ?? []).filter(
      (task) => !overdueIds.has(task.id) && task.status !== "COMPLETED",
    );
    const completed = myDay.data?.completedTasks?.items ?? [];
    return { overdue, today, completed };
  }, [myDay.data]);

  const openCount = groups.overdue.length + groups.today.length;
  const totalCount = openCount + groups.completed.length;
  const completedCount = groups.completed.length;
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const hasWork = totalCount > 0;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => openTaskCreate()}>
        <Plus className="h-4 w-4" />
        Add Task
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpenCreateDialog("meeting")}
      >
        <CalendarPlus className="h-4 w-4" />
        Schedule Meeting
      </Button>
    </div>
  );

  return (
    <PageShell className="max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            {todayLabel()}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#172033]">
            My Day
          </h1>
          <p className="text-sm text-[#64748B]">{greeting(firstName)}</p>
          <div className="max-w-xs pt-2">
            <p className="text-sm font-medium text-[#172033]">
              {completedCount} of {totalCount} tasks completed
            </p>
            <Meter className="mt-2 h-1.5" value={progress} />
          </div>
        </div>
        {actions}
      </header>

      {myDay.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : myDay.isError ? (
        <p className="text-sm text-destructive">{myDay.error.message}</p>
      ) : !myDay.data ? (
        <EmptyState title="Unable to load My Day" />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[#172033]">
                Today&apos;s tasks
              </h2>
              <p className="mt-0.5 text-sm text-[#64748B]">
                What you need to do today.
              </p>
            </div>

            {!hasWork ? (
              <EmptyState
                title="Nothing planned for today"
                description="You're all caught up. Enjoy your day!"
                action={
                  <Button size="sm" onClick={() => openTaskCreate()}>
                    <Plus className="h-4 w-4" />
                    Add Task
                  </Button>
                }
              />
            ) : (
              <div className="space-y-6">
                <TaskGroup title="Overdue" count={groups.overdue.length}>
                  {groups.overdue.map((task) => (
                    <TaskRow key={task.id} task={task} tone="overdue" />
                  ))}
                </TaskGroup>
                <TaskGroup title="Today" count={groups.today.length}>
                  {groups.today.map((task) => (
                    <TaskRow key={task.id} task={task} tone="today" />
                  ))}
                </TaskGroup>
                <TaskGroup
                  title="Completed"
                  count={groups.completed.length}
                  collapsible
                >
                  {groups.completed.map((task) => (
                    <TaskRow key={task.id} task={task} tone="completed" />
                  ))}
                </TaskGroup>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-4">
            <h2 className="text-sm font-semibold text-[#172033]">
              Today&apos;s schedule
            </h2>
            {myDay.data.meetings.total === 0 ? (
              <p className="mt-3 text-sm text-[#64748B]">
                You&apos;re free today — no meetings scheduled.
              </p>
            ) : (
              <div className="mt-1 divide-y divide-[#E5E7EB]">
                {myDay.data.meetings.items.map((meeting) => (
                  <MeetingRow key={meeting.id} meeting={meeting} />
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  );
}
