"use client";

import Link from "next/link";
import { CalendarClock, FolderKanban } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import type { Task } from "@/features/tasks/types";
import { cn, formatDate } from "@/lib/utils";

const DAY_MS = 86_400_000;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/** Relative due label ("Today", "in 3d", "2d ago") plus overdue flag. */
export function dueInfo(
  dueDate: string | null | undefined,
  status: string,
  now: number = Date.now(),
) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.round((startOfDay(due) - startOfDay(new Date(now))) / DAY_MS);
  const done = status === "COMPLETED" || status === "ARCHIVED";
  const overdue = !done && (days < 0 || status === "OVERDUE");
  let label: string;
  if (days === 0) label = "Today";
  else if (days === 1) label = "Tomorrow";
  else if (days === -1) label = "Yesterday";
  else if (days > 1 && days < 7) label = `in ${days}d`;
  else if (days < -1 && days > -7) label = `${-days}d ago`;
  else
    label = due.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(due.getFullYear() !== new Date(now).getFullYear()
        ? { year: "numeric" as const }
        : {}),
    });
  return { label, overdue, days, full: formatDate(dueDate) };
}

export function TaskDue({
  task,
  className,
  showIcon = true,
}: {
  task: Pick<Task, "dueDate" | "status">;
  className?: string;
  showIcon?: boolean;
}) {
  const info = dueInfo(task.dueDate, task.status);
  if (!info) {
    return <span className={cn("text-sm text-subtle-foreground", className)}>No due date</span>;
  }
  return (
    <span
      title={`Due ${info.full}${info.overdue ? " (overdue)" : ""}`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-sm tabular",
        info.overdue
          ? "font-medium text-danger-soft-foreground"
          : info.days === 0
            ? "text-warning-soft-foreground"
            : "text-muted-foreground",
        className,
      )}
    >
      {showIcon ? <CalendarClock className="size-3.5 shrink-0" aria-hidden /> : null}
      {info.label}
    </span>
  );
}

export function taskAssignees(task: Task) {
  return (task.assignees ?? []).length
    ? task.assignees
    : task.assignee
      ? [task.assignee]
      : [];
}

export function submissionSummary(task: Task) {
  const progress = task.submissionProgress;
  if (!progress || progress.total <= 1) return null;
  return progress.approved > 0
    ? `${progress.approved} of ${progress.total} approved`
    : `${progress.submitted} of ${progress.total} submitted`;
}

/** Avatar stack for a task's assignees, with the submission progress as muted text. */
export function TaskAssignees({
  task,
  max = 3,
  showProgress = true,
  tooltip = true,
  className,
}: {
  task: Task;
  max?: number;
  showProgress?: boolean;
  /** Set false when rendered inside a link (avoids nested focus targets). */
  tooltip?: boolean;
  className?: string;
}) {
  const people = taskAssignees(task);
  const summary = submissionSummary(task);
  if (!people.length) {
    return <span className={cn("text-sm text-subtle-foreground", className)}>Unassigned</span>;
  }
  const names = people.map((person) => person.name).join(", ");
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {tooltip ? (
        <Tooltip content={names}>
          <span
            tabIndex={0}
            aria-label={`Assignees: ${names}`}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AvatarStack people={people} max={max} size="sm" />
          </span>
        </Tooltip>
      ) : (
        <span title={names}>
          <AvatarStack people={people} max={max} size="sm" />
        </span>
      )}
      {people.length === 1 ? (
        <span className="truncate text-sm text-muted-foreground">{people[0].name}</span>
      ) : null}
      {showProgress && summary ? (
        <span className="truncate text-xs text-subtle-foreground tabular">{summary}</span>
      ) : null}
    </div>
  );
}

export function ProjectChip({
  project,
  link = false,
  className,
}: {
  project: Task["project"];
  link?: boolean;
  className?: string;
}) {
  if (!project) {
    return <span className={cn("text-sm text-subtle-foreground", className)}>No project</span>;
  }
  const classes = cn(
    "inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
    link &&
      "transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const body = (
    <>
      <FolderKanban className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{project.name}</span>
    </>
  );
  return link ? (
    <Link href={`/app/projects/${project.id}`} className={classes}>
      {body}
    </Link>
  ) : (
    <span className={classes}>{body}</span>
  );
}

/** Dot colour for a status, matching `StatusBadge` tones. */
export const STATUS_DOT: Record<string, string> = {
  TODO: "bg-subtle-foreground",
  IN_PROGRESS: "bg-info",
  IN_REVIEW: "bg-primary",
  RETURNED: "bg-danger",
  OVERDUE: "bg-danger",
  COMPLETED: "bg-success",
  ARCHIVED: "bg-border-strong",
};
