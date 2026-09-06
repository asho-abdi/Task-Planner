"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { LayoutGrid, List } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  Surface,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import {
  PRIORITIES,
  TASK_STATUSES,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/features/tasks/types";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { AiPlanDialog } from "@/features/ai/ui";
import { nativeSelectClass } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const BOARD_COLUMNS: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RETURNED",
  "OVERDUE",
  "COMPLETED",
];

export default function TasksPage() {
  return (
    <Suspense fallback={<PageShell><Skeleton className="h-40 w-full" /></PageShell>}>
      <TasksPageContent />
    </Suspense>
  );
}

function TasksPageContent() {
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  return <TasksList key={urlQ} initialQ={urlQ} />;
}

function TasksList({ initialQ }: { initialQ: string }) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const canWrite = workspace && workspace.role !== "VIEWER";

  const [draftSearch, setDraftSearch] = useState(initialQ);
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [projectId, setProjectId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "board">("list");
  const [planOpen, setPlanOpen] = useState(false);
  const pageSize = 20;

  const projects = useProjects(workspaceId);
  const tasks = useTasks(workspaceId, {
    q: q || undefined,
    status: status || undefined,
    priority: priority || undefined,
    projectId: projectId || undefined,
    includeArchived,
    page,
    pageSize,
  });

  const items = tasks.data?.items ?? [];
  const total = tasks.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(draftSearch.trim());
  }

  return (
    <PageShell>
      <PageHeader
        title="Tasks"
        description="Search, filter, and manage workspace tasks."
        actions={
          <>
            <div className="flex rounded-xl border border-border bg-card p-0.5">
              <Button
                type="button"
                size="sm"
                variant={view === "list" ? "secondary" : "ghost"}
                onClick={() => setView("list")}
              >
                <List />
                List
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "board" ? "secondary" : "ghost"}
                onClick={() => setView("board")}
              >
                <LayoutGrid />
                Board
              </Button>
            </div>
            <Button variant="outline" onClick={() => setPlanOpen(true)}>
              Plan
            </Button>
            {canWrite ? (
              <Button onClick={() => openTaskCreate()}>New task</Button>
            ) : null}
          </>
        }
      />

      <Surface>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={applySearch}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="task-search">Search</Label>
            <div className="flex gap-2">
              <Input
                id="task-search"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Title or description"
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-status">Status</Label>
            <select
              id="filter-status"
              className={nativeSelectClass}
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as TaskStatus | "");
              }}
            >
              <option value="">Any</option>
              {TASK_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-priority">Priority</Label>
            <select
              id="filter-priority"
              className={nativeSelectClass}
              value={priority}
              onChange={(event) => {
                setPage(1);
                setPriority(event.target.value as Priority | "");
              }}
            >
              <option value="">Any</option>
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="filter-project">Project</Label>
            {projects.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <select
                id="filter-project"
                className={nativeSelectClass}
                value={projectId}
                onChange={(event) => {
                  setPage(1);
                  setProjectId(event.target.value);
                }}
              >
                <option value="">Any project</option>
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => {
                setPage(1);
                setIncludeArchived(event.target.checked);
              }}
            />
            Include archived
          </label>
        </form>
      </Surface>

      {tasks.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : tasks.isError ? (
        <p className="text-sm text-destructive">{tasks.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No tasks match"
          description="Try another search or create a task."
          action={
            canWrite ? (
              <Button onClick={() => openTaskCreate()}>New task</Button>
            ) : undefined
          }
        />
      ) : view === "board" ? (
        <TaskBoard items={items} />
      ) : (
        <Surface className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Link
                      href={`/app/tasks/${task.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.project?.name ?? "No project"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(task.assignees ?? []).length
                      ? (task.assignees ?? []).map((person) => person.name).join(", ")
                      : (task.assignee?.name ?? "Unassigned")}
                    {task.submissionProgress && task.submissionProgress.total > 1
                      ? task.submissionProgress.approved > 0
                        ? ` · ${task.submissionProgress.approved} of ${task.submissionProgress.total} approved`
                        : ` · ${task.submissionProgress.submitted} of ${task.submissionProgress.total} submitted`
                      : ""}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={task.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={task.priority} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.dueDate ? task.dueDate.slice(0, 10) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {total} tasks · page {page} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      <AiPlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        canWrite={Boolean(canWrite)}
      />
    </PageShell>
  );
}

function TaskBoard({ items }: { items: Task[] }) {
  const columns = includeArchivedColumns(items);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((status) => {
        const columnItems = items.filter((task) => task.status === status);
        return (
          <div
            key={status}
            className="w-72 shrink-0 rounded-xl bg-secondary p-3"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-sm font-medium">
                {status.replaceAll("_", " ")}
              </p>
              <span className="text-xs text-muted-foreground">
                {columnItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnItems.map((task) => (
                <Link
                  key={task.id}
                  href={`/app/tasks/${task.id}`}
                  className="block rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40"
                >
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.project?.name ?? "No project"}
                  </p>
                  <div className="mt-2">
                    <StatusBadge value={task.priority} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function includeArchivedColumns(items: Task[]) {
  if (items.some((item) => item.status === "ARCHIVED")) {
    return [...BOARD_COLUMNS, "ARCHIVED" as TaskStatus];
  }
  return BOARD_COLUMNS;
}
