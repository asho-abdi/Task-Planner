"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarPlus, Check, ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import { EmptyState, PageShell } from "@/components/page-header";
import { MemberAvatarGroup } from "@/components/member-avatar-group";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

function priorityLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
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
      <button
        type="button"
        aria-label={`Actions for ${task.title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] opacity-0 transition-opacity hover:bg-[#F8FAFC] hover:text-[#172033] group-hover:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        >
          <Link
            role="menuitem"
            href={`/app/tasks/${task.id}`}
            className="block px-3 py-1.5 text-[13px] text-[#172033] hover:bg-[#F8FAFC]"
            onClick={() => setOpen(false)}
          >
            Open task
          </Link>
          {startable ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-[13px] text-[#172033] hover:bg-[#F8FAFC]"
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
              className="block px-3 py-1.5 text-[13px] text-[#172033] hover:bg-[#F8FAFC]"
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
    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
    done
      ? "border-primary bg-primary text-white"
      : startable
        ? "border-[#CBD5E1] bg-white hover:border-primary"
        : "border-primary bg-primary/10",
  );

  if (done) {
    return (
      <span aria-label={`${task.title} completed`} className={className}>
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
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
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
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
        "group flex items-center gap-3 px-4 py-2.5",
        tone === "overdue" && "bg-[#FEF2F2]/60",
        tone === "completed" && "opacity-55",
      )}
    >
      <TaskStatusControl task={task} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/app/tasks/${task.id}`}
            className={cn(
              "truncate text-[13px] font-medium text-[#172033] hover:text-primary",
              tone === "completed" && "text-[#64748B] line-through",
            )}
          >
            {task.title}
          </Link>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[#64748B]">
          {tone === "overdue" ? (
            <span className="text-[#EF4444]">
              Overdue
              {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}
            </span>
          ) : null}
          {tone === "overdue" ? " · " : null}
          {task.project?.name ?? "No project"}
          {task.priority ? ` · ${priorityLabel(task.priority)}` : ""}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {tone !== "overdue" && time ? (
          <span className="text-[12px] tabular-nums text-[#64748B]">{time}</span>
        ) : null}
        {people.length ? <MemberAvatarGroup people={people} limit={2} /> : null}
      </div>
      {tone === "completed" ? null : <TaskMenu task={task} />}
    </div>
  );
}

function TaskSection({
  title,
  count,
  children,
  collapsible = false,
}: {
  title: string;
  count: number;
  children: ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  if (count === 0) return null;

  const heading = (
    <div className="flex items-center gap-2 px-4 py-2">
      {collapsible ? (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[#94A3B8] transition-transform",
            !open && "-rotate-90",
          )}
        />
      ) : null}
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
        {title}
      </span>
      <span className="text-[11px] tabular-nums text-[#CBD5E1]">{count}</span>
    </div>
  );

  return (
    <div>
      {collapsible ? (
        <button
          type="button"
          className="flex w-full items-center text-left"
          onClick={() => setOpen((value) => !value)}
        >
          {heading}
        </button>
      ) : (
        heading
      )}
      {open ? <div className="divide-y divide-[#F1F5F9]">{children}</div> : null}
    </div>
  );
}

function MeetingRow({
  meeting,
  last,
}: {
  meeting: InsightMeeting;
  last: boolean;
}) {
  const context = meeting.project?.name ?? meeting.team?.name ?? null;
  const online = meetingPlace(meeting) === "Online";

  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      {!last ? (
        <span className="absolute left-[3px] top-4 h-[calc(100%-8px)] w-px bg-[#E5E7EB]" />
      ) : null}
      <span className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-medium tabular-nums text-[#64748B]">
              {formatTime(meeting.startAt)}
              {meeting.endAt ? ` – ${formatTime(meeting.endAt)}` : ""}
            </p>
            <Link
              href={`/app/meetings/${meeting.id}`}
              className="mt-0.5 block truncate text-[13px] font-medium text-[#172033] hover:text-primary"
            >
              {meeting.title}
            </Link>
            <p className="mt-0.5 truncate text-[12px] text-[#64748B]">
              {context ? `${context} · ` : ""}
              {meetingPlace(meeting)}
            </p>
          </div>
          {online && meeting.meetingLink ? (
            <a
              href={meeting.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 pt-0.5 text-[12px] font-medium text-primary hover:underline"
            >
              Join
            </a>
          ) : (
            <Link
              href={`/app/meetings/${meeting.id}`}
              className="shrink-0 pt-0.5 text-[12px] font-medium text-[#64748B] hover:text-primary"
            >
              View
            </Link>
          )}
        </div>
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
    const completed = myDay.data?.completedTasks?.items ?? [];
    return { overdue, today, completed };
  }, [myDay.data]);

  const meetings = myDay.data?.meetings.items ?? [];
  const openCount = groups.overdue.length + groups.today.length;
  const totalCount = openCount + groups.completed.length;
  const hasWork = totalCount > 0;

  return (
    <PageShell className="max-w-[1080px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-[72px] w-[64px] shrink-0 flex-col items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {now.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-[#172033]">
              {now.getDate()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#64748B]">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
              })}
            </p>
            <h1 className="font-heading mt-0.5 truncate text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#172033] sm:text-[30px]">
              {greeting(firstName)}
            </h1>
            <p className="mt-1 text-[15px] font-normal leading-[1.5] text-[#64748B]">
              <span className="tabular-nums text-[#172033]">{openCount}</span>{" "}
              open
              {groups.overdue.length ? (
                <>
                  {" · "}
                  <span className="tabular-nums text-[#EF4444]">
                    {groups.overdue.length}
                  </span>{" "}
                  overdue
                </>
              ) : null}
              {" · "}
              <span className="tabular-nums text-[#172033]">
                {meetings.length}
              </span>{" "}
              {meetings.length === 1 ? "meeting" : "meetings"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpenCreateDialog("meeting")}
          >
            <CalendarPlus className="h-4 w-4" />
            Meeting
          </Button>
          <Button size="sm" onClick={() => openTaskCreate()}>
            <Plus className="h-4 w-4" />
            Task
          </Button>
        </div>
      </header>

      {myDay.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Skeleton className="h-72 w-full rounded-[12px]" />
          <Skeleton className="h-56 w-full rounded-[12px]" />
        </div>
      ) : myDay.isError ? (
        <p className="text-sm text-destructive">{myDay.error.message}</p>
      ) : !myDay.data ? (
        <EmptyState title="Unable to load My Day" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
            {!hasWork ? (
              <div className="px-4">
                <EmptyState
                  title="Clear day"
                  description="Nothing is assigned for today."
                  action={
                    <Button size="sm" onClick={() => openTaskCreate()}>
                      <Plus className="h-4 w-4" />
                      Add a task
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                <TaskSection title="Overdue" count={groups.overdue.length}>
                  {groups.overdue.map((task) => (
                    <TaskRow key={task.id} task={task} tone="overdue" />
                  ))}
                </TaskSection>
                <TaskSection title="Today" count={groups.today.length}>
                  {groups.today.map((task) => (
                    <TaskRow key={task.id} task={task} tone="today" />
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
          </section>

          <aside className="rounded-[12px] border border-[#E5E7EB] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-[#172033]">
                Schedule
              </h2>
              <span className="text-[12px] tabular-nums text-[#94A3B8]">
                {meetings.length}
              </span>
            </div>
            {meetings.length === 0 ? (
              <p className="mt-6 text-[13px] leading-5 text-[#64748B]">
                No meetings on the calendar.
              </p>
            ) : (
              <div className="mt-4">
                {meetings.map((meeting, index) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    last={index === meetings.length - 1}
                  />
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  );
}
