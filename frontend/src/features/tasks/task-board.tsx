"use client";

import Link from "next/link";
import { PriorityBadge, statusLabel } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task, TaskStatus } from "@/features/tasks/types";
import {
  ProjectChip,
  STATUS_DOT,
  TaskDue,
  submissionSummary,
  taskAssignees,
} from "@/features/tasks/task-meta";
import { cn } from "@/lib/utils";

export const BOARD_COLUMNS: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RETURNED",
  "OVERDUE",
  "COMPLETED",
];

function boardColumns(items: Task[]) {
  if (items.some((item) => item.status === "ARCHIVED")) {
    return [...BOARD_COLUMNS, "ARCHIVED" as TaskStatus];
  }
  return BOARD_COLUMNS;
}

/** Kanban board: one column per status. Clicking a card opens the task. */
export function TaskBoard({ items }: { items: Task[] }) {
  const columns = boardColumns(items);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max items-start gap-3">
        {columns.map((status) => {
          const columnItems = items.filter((task) => task.status === status);
          return (
            <section
              key={status}
              aria-label={`${statusLabel(status)} (${columnItems.length})`}
              className="flex w-[272px] shrink-0 flex-col rounded-xl border border-border bg-muted/50"
            >
              <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", STATUS_DOT[status] ?? "bg-subtle-foreground")}
                />
                <h3 className="text-sm font-semibold text-foreground">
                  {statusLabel(status)}
                </h3>
                <span className="ml-auto rounded-full bg-card px-1.5 text-xs font-medium text-muted-foreground tabular shadow-xs">
                  {columnItems.length}
                </span>
              </header>
              <div className="flex max-h-[calc(100vh-18rem)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {columnItems.length ? (
                  columnItems.map((task) => <BoardCard key={task.id} task={task} />)
                ) : (
                  <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-subtle-foreground">
                    No tasks
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ task }: { task: Task }) {
  const people = taskAssignees(task);
  const summary = submissionSummary(task);
  return (
    <Link
      href={`/app/tasks/${task.id}`}
      className="group block rounded-lg border border-border bg-card p-3 shadow-xs transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="line-clamp-2 text-base font-medium leading-snug text-foreground group-hover:text-primary">
        {task.title}
      </p>
      {task.project ? (
        <div className="mt-2">
          <ProjectChip project={task.project} />
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <PriorityBadge value={task.priority} />
        <TaskDue task={task} className="text-xs" />
        <div className="ml-auto flex items-center gap-1.5">
          {summary ? (
            <span title={summary} className="text-2xs text-subtle-foreground tabular">
              {task.submissionProgress.approved > 0
                ? task.submissionProgress.approved
                : task.submissionProgress.submitted}
              /{task.submissionProgress.total}
            </span>
          ) : null}
          {people.length ? (
            <span title={people.map((person) => person.name).join(", ")}>
              <AvatarStack people={people} max={3} size="xs" />
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function TaskBoardSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex gap-3 overflow-hidden">
      {BOARD_COLUMNS.slice(0, 4).map((status) => (
        <div
          key={status}
          className="w-[272px] shrink-0 space-y-2 rounded-xl border border-border bg-muted/50 p-2"
        >
          <Skeleton className="m-1 h-4 w-24" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-lg border border-border bg-card p-3">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
              <div className="flex justify-between">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="size-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
