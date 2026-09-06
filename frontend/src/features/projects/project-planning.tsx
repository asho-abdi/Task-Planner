"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Surface } from "@/components/page-header";
import { Meter } from "@/features/insights/ui";
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
    setTitle("");
    setDueDate("");
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <Surface>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={add}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Website Launch"
            />
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <Button type="submit" disabled={createMilestone.isPending}>
              Add milestone
            </Button>
          </form>
        </Surface>
      ) : null}
      {milestones.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading milestones…</p>
      ) : (milestones.data ?? []).length === 0 ? (
        <EmptyState
          title="No milestones"
          description="Add a milestone and link tasks to it from the task page."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(milestones.data ?? []).map((item) => (
            <Surface key={item.id}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Milestone
              </p>
              <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Due: {item.dueDate ? formatDate(item.dueDate) : "No date"}
              </p>
              <p className="mt-3 text-sm">Progress: {item.progress}%</p>
              <Meter className="mt-2" value={item.progress} />
              <p className="mt-2 text-xs text-muted-foreground">
                {item.taskCount} linked tasks
              </p>
              {canWrite ? (
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => void removeMilestone.mutateAsync(item.id)}
                >
                  Remove
                </Button>
              ) : null}
            </Surface>
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
    return <p className="text-sm text-muted-foreground">Loading timeline…</p>;
  }
  if (!timeline.data) {
    return <EmptyState title="Unable to load timeline" />;
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
      <div className="space-y-3">
        {data.milestones.map((item) => {
          if (!item.dueDate) return null;
          const left =
            ((new Date(item.dueDate).getTime() - start) / span) * 100;
          return (
            <div key={item.id} className="relative h-8 rounded-lg bg-secondary">
              <div
                className="absolute top-1 h-6 w-1 rounded-full bg-primary"
                style={{ left: `${Math.min(98, Math.max(0, left))}%` }}
                title={item.title}
              />
              <p className="absolute left-3 top-1.5 text-xs font-medium">
                {item.title} · {item.progress}%
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
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/app/tasks/${task.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {task.title}
                  </Link>
                  {task.blocked && task.dependsOn[0] ? (
                    <p className="text-xs text-muted-foreground">
                      🔒 Blocked by “
                      {titleById.get(task.dependsOn[0]) ?? "another task"}”
                    </p>
                  ) : null}
                </div>
                {data.canEdit ? (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className={nativeSelectClass}
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
                      className={nativeSelectClass}
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
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
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
          <EmptyState title="No tasks on the timeline yet" />
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
    setTitle("");
    setSelectedId(page.id);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Surface className="space-y-3">
        <p className="text-sm font-semibold">Notes</p>
        {canWrite ? (
          <form className="space-y-2" onSubmit={add}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Note title"
            />
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={createPage.isPending}
            >
              New note
            </Button>
          </form>
        ) : null}
        {pages.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notes…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes yet. Capture decisions and project context here.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-left text-sm",
                    item.id === selected?.id
                      ? "bg-accent font-medium text-accent-foreground"
                      : "hover:bg-secondary",
                  )}
                >
                  {item.title.slice(marker.length) || item.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {createPage.error ? (
          <p className="text-sm text-destructive">{createPage.error.message}</p>
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
        <EmptyState
          title="No notes yet"
          description="Create a note to keep project details next to the work."
        />
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
  }

  return (
    <Surface>
      <form className="space-y-3" onSubmit={save}>
        <Input
          value={title}
          disabled={!canWrite}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className={nativeTextareaClass}
          rows={14}
          value={body}
          disabled={!canWrite}
          onChange={(event) => setBody(event.target.value)}
        />
        {canWrite ? (
          <Button type="submit" disabled={updatePage.isPending}>
            {updatePage.isPending ? "Saving…" : "Save note"}
          </Button>
        ) : null}
        {updatePage.error ? (
          <p className="text-sm text-destructive">{updatePage.error.message}</p>
        ) : null}
      </form>
    </Surface>
  );
}
