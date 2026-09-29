"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ListPanel } from "@/components/page-header";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Task } from "@/features/tasks/types";
import {
  ProjectChip,
  TaskAssignees,
  TaskDue,
} from "@/features/tasks/task-meta";

/** Task table on sm+, stacked cards on phones. */
export function TaskList({ items }: { items: Task[] }) {
  return (
    <ListPanel>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[38%]">Task</TableHead>
              <TableHead className="hidden lg:table-cell">Project</TableHead>
              <TableHead>Assignees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Priority</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((task) => (
              <TableRow key={task.id} className="group">
                <TableCell className="max-w-0">
                  <Link
                    href={`/app/tasks/${task.id}`}
                    className="block truncate rounded-sm font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={task.title}
                  >
                    {task.title}
                  </Link>
                  {task.project ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground lg:hidden">
                      {task.project.name}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="hidden max-w-48 lg:table-cell">
                  <ProjectChip project={task.project} />
                </TableCell>
                <TableCell>
                  <TaskAssignees task={task} />
                </TableCell>
                <TableCell>
                  <StatusBadge value={task.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <PriorityBadge value={task.priority} />
                </TableCell>
                <TableCell className="text-right">
                  <TaskDue task={task} showIcon={false} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border sm:hidden">
        {items.map((task) => (
          <li key={task.id}>
            <Link
              href={`/app/tasks/${task.id}`}
              className="flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-base font-medium leading-snug text-foreground">
                    {task.title}
                  </p>
                  <TaskDue task={task} className="shrink-0 text-xs" />
                </div>
                {task.project ? <ProjectChip project={task.project} /> : null}
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge value={task.status} />
                  <PriorityBadge value={task.priority} />
                  <TaskAssignees task={task} className="ml-auto" max={3} tooltip={false} />
                </div>
              </div>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </ListPanel>
  );
}

export function TaskListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ListPanel>
      <div role="status" aria-label="Loading tasks">
        <div className="hidden h-10 items-center gap-4 border-b border-border bg-muted/50 px-4 sm:flex">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="ml-auto h-2.5 w-12" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5" style={{ width: `${40 + ((index * 17) % 35)}%` }} />
                <Skeleton className="h-2.5 w-24 lg:hidden" />
              </div>
              <Skeleton className="hidden h-5 w-28 rounded-md lg:block" />
              <div className="hidden -space-x-1.5 sm:flex">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="size-6 rounded-full" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
              <Skeleton className="hidden h-3 w-14 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </ListPanel>
  );
}
