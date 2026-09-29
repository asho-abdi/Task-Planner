"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Flag,
  GanttChart,
  ListChecks,
  Lock,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress, progressTone } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState, Surface } from "@/components/page-header";
import {
  useCreatePage,
  usePages,
  useUpdatePage,
} from "@/features/collaboration/hooks";
import {
  useCreateProjectMilestone,
  useDeleteProjectMilestone,
  useProjectMilestones,
  useProjectTimeline,
} from "@/features/projects/hooks";
import { useMutateTask } from "@/features/tasks/hooks";
import {
  cn,
  formatDate,
  fromDateInputValue,
  nativeSelectClass,
  nativeTextareaClass,
  toDateInputValue,
} from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

export function ProjectMilestonesPanel({
  projectId,
  canWrite,
}: {
  projectId: string;
  canWrite: boolean;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const milestones = useProjectMilestones(workspaceId, projectId);
  const createMilestone = useCreateProjectMilestone(projectId);
  const removeMilestone = useDeleteProjectMilestone(projectId);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await createMilestone.mutateAsync({
      title: title.trim(),
      dueDate: fromDateInputValue(dueDate),
    });
    toast.success("Milestone added");
    setTitle("");
    setDueDate("");
  }

  return (
    <div className="space-y-3">
      {canWrite ? (
        <form
          className="grid gap-2 rounded-xl border border-dashed border-border-strong bg-card p-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
          onSubmit={add}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="New milestone, e.g. Website launch"
            aria-label="Milestone title"
          />
          <Input
            type="date"
            value={dueDate}
            aria-label="Milestone due date"
            onChange={(event) => setDueDate(event.target.value)}
          />
          <Button type="submit" loading={createMilestone.isPending}>
            <Plus />
            Add milestone
          </Button>
        </form>
      ) : null}
      {milestones.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (milestones.data ?? []).length === 0 ? (
        <Surface className="p-0 sm:p-0">
          <EmptyState
            compact
            icon={Flag}
            title="No milestones"
            description="Add a milestone and link tasks to it from the task page."
          />
        </Surface>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(milestones.data ?? []).map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    item.progress >= 100
                      ? "bg-success-soft text-success-soft-foreground"
                      : "bg-primary-soft text-primary-soft-foreground",
                  )}
                >
                  <Flag className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular">
                      <CalendarDays className="size-3" />
                      {item.dueDate ? formatDate(item.dueDate) : "No date"}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular">
                      <ListChecks className="size-3" />
                      {item.taskCount} linked {item.taskCount === 1 ? "task" : "tasks"}
                    </span>
                  </p>
                </div>
                {canWrite ? (
                  <Tooltip content="Remove milestone">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove milestone ${item.title}`}
                      loading={
                        removeMilestone.isPending &&
                        removeMilestone.variables === item.id
                      }
                      onClick={() =>
                        void removeMilestone
                          .mutateAsync(item.id)
                          .then(() => toast.success("Milestone removed"))
                          .catch(() => undefined)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </Tooltip>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Progress
                  value={item.progress}
                  tone={progressTone(item.progress)}
                  aria-label={`${item.title} progress`}
                />
                <span className="w-10 shrink-0 text-right text-xs font-medium text-foreground tabular">
                  {item.progress}%
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectTimelinePanel({ projectId }: { projectId: string }) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const timeline = useProjectTimeline(workspaceId, projectId);
  const mutateTask = useMutateTask();

  if (timeline.isLoading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading timeline">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (!timeline.data) {
    return <EmptyState icon={GanttChart} title="Unable to load timeline" />;
  }

  const data = timeline.data;
  const start = new Date(data.range.start).getTime();
  const end = Math.max(
    new Date(data.range.end).getTime(),
    start + 14 * 24 * 60 * 60 * 1000,
  );
  const span = Math.max(1, end - start);
  const titleById = new Map(data.tasks.map((task) => [task.id, task.title]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tasks, dependencies, and milestones stay in sync with the task list.
      </p>
      <div className="space-y-2">
        {data.milestones.map((item) => {
          if (!item.dueDate) return null;
          const left =
            ((new Date(item.dueDate).getTime() - start) / span) * 100;
          return (
            <div key={item.id} className="relative h-8 rounded-lg bg-muted">
              <div
                className="absolute top-1 h-6 w-1 rounded-full bg-primary"
                style={{ left: `${Math.min(98, Math.max(0, left))}%` }}
                title={item.title}
              />
              <p className="absolute left-3 top-1.5 text-xs font-medium text-foreground">
                {item.title} · <span className="tabular">{item.progress}%</span>
              </p>
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        {data.tasks.map((task) => {
          const from = task.startDate
            ? new Date(task.startDate).getTime()
            : task.dueDate
              ? new Date(task.dueDate).getTime() - 3 * 24 * 60 * 60 * 1000
              : start;
          const to = task.dueDate
            ? new Date(task.dueDate).getTime()
            : from + 2 * 24 * 60 * 60 * 1000;
          const left = ((from - start) / span) * 100;
          const width = Math.max(4, ((to - from) / span) * 100);
          return (
            <div
              key={task.id}
              className="rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/app/tasks/${task.id}`}
                    className="rounded-sm text-base font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {task.title}
                  </Link>
                  {task.blocked && task.dependsOn[0] ? (
                    <p className="inline-flex items-center gap-1 text-xs text-warning-soft-foreground">
                      <Lock className="size-3" />
                      Blocked by “
                      {titleById.get(task.dependsOn[0]) ?? "another task"}”
                    </p>
                  ) : null}
                </div>
                {data.canEdit ? (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      aria-label={`Start date for ${task.title}`}
                      className={cn(nativeSelectClass, "h-8")}
                      value={toDateInputValue(task.startDate)}
                      onChange={(event) =>
                        void mutateTask.mutateAsync({
                          taskId: task.id,
                          input: {
                            startDate:
                              fromDateInputValue(event.target.value) ?? null,
                          },
                        })
                      }
                    />
                    <input
                      type="date"
                      aria-label={`Due date for ${task.title}`}
                      className={cn(nativeSelectClass, "h-8")}
                      value={toDateInputValue(task.dueDate)}
                      onChange={(event) =>
                        void mutateTask.mutateAsync({
                          taskId: task.id,
                          input: {
                            dueDate:
                              fromDateInputValue(event.target.value) ?? null,
                          },
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute h-full rounded-full bg-primary"
                  style={{
                    left: `${Math.min(96, Math.max(0, left))}%`,
                    width: `${Math.min(100 - left, width)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
        {data.tasks.length === 0 ? (
          <EmptyState icon={GanttChart} title="No tasks on the timeline yet" />
        ) : null}
      </div>
    </div>
  );
}

export function ProjectNotesPanel({
  projectId,
  projectName,
  canWrite,
}: {
  projectId: string;
  projectName: string;
  canWrite: boolean;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const pages = usePages(workspaceId);
  const createPage = useCreatePage();
  const [title, setTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const marker = `[project:${projectId}] `;
  const items = (pages.data ?? []).filter((item) =>
    item.title.startsWith(marker),
  );
  const selected =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  async function add(event: FormEvent) {
    event.preventDefault();
    const label = title.trim() || `${projectName} note`;
    const page = await createPage.mutateAsync({
      title: `${marker}${label}`,
    });
    toast.success("Note created");
    setTitle("");
    setSelectedId(page.id);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Surface className="space-y-3 p-3 sm:p-3">
        <p className="px-1 text-sm font-semibold text-foreground">Notes</p>
        {canWrite ? (
          <form className="space-y-2" onSubmit={add}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Note title"
              aria-label="Note title"
            />
            <Button
              type="submit"
              size="sm"
              variant="soft"
              className="w-full"
              loading={createPage.isPending}
            >
              <Plus />
              New note
            </Button>
          </form>
        ) : null}
        {pages.isLoading ? (
          <div className="space-y-1.5" role="status" aria-label="Loading notes">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            No notes yet. Capture decisions and project context here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-current={item.id === selected?.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    item.id === selected?.id
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <NotebookPen className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {item.title.slice(marker.length) || item.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {createPage.error ? (
          <p className="text-sm text-danger-soft-foreground">
            {createPage.error.message}
          </p>
        ) : null}
      </Surface>
      {selected ? (
        <ProjectNoteEditor
          key={selected.id}
          page={selected}
          marker={marker}
          canWrite={canWrite}
        />
      ) : (
        <Surface className="p-0 sm:p-0">
          <EmptyState
            icon={NotebookPen}
            title="No notes yet"
            description="Create a note to keep project details next to the work."
          />
        </Surface>
      )}
    </div>
  );
}

function ProjectNoteEditor({
  page,
  marker,
  canWrite,
}: {
  page: { id: string; title: string; body: string };
  marker: string;
  canWrite: boolean;
}) {
  const updatePage = useUpdatePage(page.id);
  const [title, setTitle] = useState(
    page.title.startsWith(marker) ? page.title.slice(marker.length) : page.title,
  );
  const [body, setBody] = useState(page.body);

  async function save(event: FormEvent) {
    event.preventDefault();
    await updatePage.mutateAsync({
      title: `${marker}${title.trim() || "Untitled"}`,
      body,
    });
    toast.success("Note saved");
  }

  return (
    <Surface>
      <form className="space-y-3" onSubmit={save}>
        <Input
          value={title}
          disabled={!canWrite}
          aria-label="Note title"
          className="h-10 border-transparent px-0 font-heading text-xl font-semibold tracking-[-0.02em] shadow-none focus-visible:border-transparent"
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className={nativeTextareaClass}
          rows={14}
          value={body}
          aria-label="Note body"
          placeholder="Write something…"
          disabled={!canWrite}
          onChange={(event) => setBody(event.target.value)}
        />
        {updatePage.error ? (
          <p className="text-sm text-danger-soft-foreground">
            {updatePage.error.message}
          </p>
        ) : null}
        {canWrite ? (
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={updatePage.isPending}>
              Save note
            </Button>
          </div>
        ) : null}
      </form>
    </Surface>
  );
}
