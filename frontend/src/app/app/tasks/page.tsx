"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  ListChecks,
  Plus,
  Search,
  SearchX,
  Sparkles,
  X,
} from "lucide-react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  SegmentedControl,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/components/ui/badge";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import {
  PRIORITIES,
  TASK_STATUSES,
  type Priority,
  type TaskStatus,
} from "@/features/tasks/types";
import { TaskBoard, TaskBoardSkeleton } from "@/features/tasks/task-board";
import { TaskList, TaskListSkeleton } from "@/features/tasks/task-list";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { AiPlanDialog } from "@/features/ai/ui";
import { cn, nativeSelectClass } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <PageShell width="wide">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-8 w-full" />
          <TaskListSkeleton />
        </PageShell>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}

function TasksPageContent() {
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  return <TasksList key={urlQ} initialQ={urlQ} />;
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

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
  const hasFilters = Boolean(q || status || priority || projectId || includeArchived);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(draftSearch.trim());
  }

  function clearFilters() {
    setDraftSearch("");
    setQ("");
    setStatus("");
    setPriority("");
    setProjectId("");
    setIncludeArchived(false);
    setPage(1);
  }

  const newTaskButton = canWrite ? (
    <Button size="sm" onClick={() => openTaskCreate()}>
      <Plus />
      New task
    </Button>
  ) : null;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Tasks"
        icon={ListChecks}
        description="Search, filter and track work across the workspace."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
              <Sparkles />
              Plan
            </Button>
            {newTaskButton}
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          className="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={applySearch}
          role="search"
        >
          <div className="relative w-full sm:w-64">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
            />
            <Input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Search tasks…"
              className="h-8 pl-8 pr-8"
              aria-label="Search tasks"
            />
            {draftSearch ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setDraftSearch("");
                  if (q) {
                    setPage(1);
                    setQ("");
                  }
                }}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <select
            className={cn(nativeSelectClass, "h-8 w-[calc(50%-0.25rem)] sm:w-36")}
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as TaskStatus | "");
            }}
          >
            <option value="">Any status</option>
            {TASK_STATUSES.map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </select>
          <select
            className={cn(nativeSelectClass, "h-8 w-[calc(50%-0.25rem)] sm:w-32")}
            aria-label="Priority"
            value={priority}
            onChange={(event) => {
              setPage(1);
              setPriority(event.target.value as Priority | "");
            }}
          >
            <option value="">Any priority</option>
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {PRIORITY_LABELS[item] ?? item}
              </option>
            ))}
          </select>
          {projects.isLoading ? (
            <Skeleton className="h-8 w-full sm:w-40" />
          ) : (
            <select
              className={cn(nativeSelectClass, "h-8 w-full sm:w-44")}
              aria-label="Project"
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
          <label
            className={cn(
              "inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              includeArchived
                ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={includeArchived}
              onChange={(event) => {
                setPage(1);
                setIncludeArchived(event.target.checked);
              }}
            />
            <Archive className="size-3.5" aria-hidden />
            Archived
          </label>
          {draftSearch.trim() !== q ? (
            <Button type="submit" variant="soft" size="sm" className="animate-fade-in">
              Search
            </Button>
          ) : (
            <button type="submit" className="sr-only">
              Search
            </button>
          )}
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </form>
        <SegmentedControl
          label="View"
          value={view}
          onChange={setView}
          className="self-start lg:self-auto"
          options={[
            { value: "list", label: "List", icon: <List /> },
            { value: "board", label: "Board", icon: <Columns3 /> },
          ]}
        />
      </div>

      {tasks.isLoading ? (
        view === "board" ? (
          <TaskBoardSkeleton />
        ) : (
          <TaskListSkeleton />
        )
      ) : tasks.isError ? (
        <ErrorState
          title="Couldn't load tasks"
          description={tasks.error.message}
          action={
            <Button variant="outline" size="sm" onClick={() => void tasks.refetch()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card">
          {hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No matching tasks"
              description="Nothing matches these filters. Try another search or clear the filters."
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Create the first task to start tracking work in this workspace."
              action={newTaskButton ?? undefined}
            />
          )}
        </div>
      ) : view === "board" ? (
        <TaskBoard items={items} />
      ) : (
        <TaskList items={items} />
      )}

      {!tasks.isLoading && total > 0 ? (
        <div className="flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground tabular">
            Showing <span className="font-medium text-foreground">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span> tasks
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft />
              Previous
            </Button>
            <span className="min-w-20 text-center text-sm text-muted-foreground tabular">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
      <AiPlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        canWrite={Boolean(canWrite)}
      />
    </PageShell>
  );
}
