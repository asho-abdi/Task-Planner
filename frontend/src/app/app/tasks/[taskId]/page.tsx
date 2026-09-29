"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Calendar, CheckSquare, Flag, FolderKanban, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageShell } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { useProjects, useProjectMilestones } from "@/features/projects/hooks";
import {
  useAssignTask,
  useDeleteTask,
  useShareTask,
  useTask,
  useTasks,
  useUpdateTask,
} from "@/features/tasks/hooks";
import { ShareDialog } from "@/features/tasks/share-dialog";
import { PeoplePicker } from "@/features/tasks/people-picker";
import {
  TaskCommentsSection,
  TaskReviewPanel,
  TaskWorkPanel,
} from "@/features/tasks/task-workflow";
import {
  PRIORITIES,
  type Priority,
  type Task,
} from "@/features/tasks/types";
import {
  useCurrentWorkspace,
  useWorkspaceMembers,
} from "@/features/workspaces/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import { useFiles, useTeams, useUploadFile } from "@/features/collaboration/hooks";
import { downloadFile } from "@/features/collaboration/api";
import {
  formatDate,
  fromDateInputValue,
  nativeSelectClass,
  nativeTextareaClass,
  toDateInputValue,
} from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const workspaceCard =
  "rounded-2xl border-[#E5E7EB] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const task = useTask(workspaceId, params.taskId);
  const projects = useProjects(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const dependencyOptions = useTasks(workspaceId, { page: 1, pageSize: 50 });
  const currentUser = useCurrentUser();

  if (task.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!task.data) {
    return <p className="text-sm text-muted-foreground">Task not found.</p>;
  }

  return (
    <TaskDetail
      key={task.data.updatedAt}
      task={task.data}
      userId={currentUser.data?.id}
      projects={projects}
      members={members}
      dependencyOptions={dependencyOptions}
    />
  );
}

function TaskDetail({
  task,
  userId,
  projects,
  members,
  dependencyOptions,
}: {
  task: Task;
  userId?: string;
  projects: ReturnType<typeof useProjects>;
  members: ReturnType<typeof useWorkspaceMembers>;
  dependencyOptions: ReturnType<typeof useTasks>;
}) {
  const router = useRouter();
  const workspace = useCurrentWorkspace();
  const taskId = task.id;
  const updateTask = useUpdateTask(taskId);
  const assignTask = useAssignTask(taskId);
  const shareTask = useShareTask(taskId);
  const deleteTask = useDeleteTask();
  const teams = useTeams(task.workspaceId);
  const milestones = useProjectMilestones(
    task.workspaceId,
    task.projectId ?? "",
    Boolean(task.projectId),
  );
  const canWrite = Boolean(workspace && workspace.role !== "VIEWER");
  const isAdmin =
    workspace?.role === "OWNER" || workspace?.role === "ADMIN";
  const canDelete = Boolean(isAdmin || task.assignedById === userId);
  const assignees = task.assignees ?? (task.assignee ? [task.assignee] : []);
  const isAssignee = Boolean(
    userId &&
      (task.ownerId === userId ||
        assignees.some((person) => person.id === userId)),
  );
  const canEditDetails = Boolean(
    canWrite && (isAdmin || (task.assignedById === userId && !isAssignee)),
  );
  const assigneeLabel = assignees.length
    ? assignees.map((person) => person.name).join(", ")
    : "Unassigned";

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [startDate, setStartDate] = useState(toDateInputValue(task.startDate));
  const [estimatedHours, setEstimatedHours] = useState(
    task.estimatedHours == null ? "" : String(task.estimatedHours),
  );
  const [dependsOnTaskIds, setDependsOnTaskIds] = useState(
    task.dependsOn.map((item) => item.id),
  );
  const [blocksTaskIds, setBlocksTaskIds] = useState(
    (task.blocks ?? []).map((item) => item.id),
  );
  const [milestoneId, setMilestoneId] = useState(task.milestoneId ?? "");
  const [projectId, setProjectId] = useState(task.projectId ?? "");
  const [assigneeIds, setAssigneeIds] = useState(
    assignees.map((person) => person.id),
  );
  const [collaboratorIds, setCollaboratorIds] = useState(
    (task.collaborators ?? []).map((person) => person.id),
  );
  const [watcherIds, setWatcherIds] = useState(
    (task.watchers ?? []).map((person) => person.id),
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [recurrence, setRecurrence] = useState(task.recurrence ?? "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const files = useFiles(task.workspaceId, { taskId: task.id });
  const upload = useUploadFile();
  const submissionFileIds = new Set(
    (task.submissions ?? []).flatMap((item) =>
      (item.files ?? []).map((file) => file.id),
    ),
  );
  const referenceFiles = (files.data ?? []).filter(
    (file) => !submissionFileIds.has(file.id),
  );
  const workflowProps = {
    task,
    userId,
    canWrite,
    isAdmin,
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    await updateTask.mutateAsync({
      title,
      description: description.trim() || null,
      priority,
      dueDate: fromDateInputValue(dueDate) ?? null,
      startDate: fromDateInputValue(startDate) ?? null,
      estimatedHours: estimatedHours === "" ? null : Number(estimatedHours),
      projectId: projectId || null,
      dependsOnTaskIds,
      blocksTaskIds,
      milestoneId: milestoneId || null,
      recurrence: recurrence ? (recurrence as "DAILY" | "WEEKLY" | "MONTHLY") : null,
    });
  }

  async function handleReassign(event: FormEvent) {
    event.preventDefault();
    await assignTask.mutateAsync({
      assigneeIds,
      collaboratorIds,
      watcherIds,
    });
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <Link
          href="/app/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-[#64748B] transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Tasks
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.10em] text-[#64748B]">
              Task
            </p>
            <div className="mt-1.5 flex items-start gap-2.5">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
                <CheckSquare className="h-4 w-4" />
              </span>
              <h1 className="font-heading text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#172033] sm:text-[30px]">
                {task.title}
              </h1>
            </div>
            <p className="mt-2 text-sm text-[#64748B]">
              {task.project ? (
                <Link
                  href={`/app/projects/${task.project.id}`}
                  className="hover:text-primary"
                >
                  {task.project.name}
                </Link>
              ) : (
                "No project"
              )}{" "}
              · Assigned to {assigneeLabel}
              {task.meeting ? (
                <>
                  {" "}
                  · Created from Meeting{" "}
                  <Link
                    href={`/app/meetings/${task.meeting.id}`}
                    className="hover:text-primary"
                  >
                    {task.meeting.title}
                  </Link>
                </>
              ) : null}
            </p>
            {task.blocked && (task.blockedBy ?? task.dependsOn)[0] ? (
              <p className="mt-2 text-sm text-amber-800">
                🔒 Blocked by “{(task.blockedBy ?? task.dependsOn)[0].title}”
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={task.status} />
            <StatusBadge value={task.priority} />
            {canEditDetails ? (
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                Share
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div className="space-y-6">
          <Card className={workspaceCard}>
            <CardHeader>
              <CardTitle className="text-[18px]">Task Information</CardTitle>
              <CardDescription>
                Description and notes for this task.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="text-sm leading-6 text-[#172033]">
                  {task.description}
                </p>
              ) : (
                <div className="rounded-xl border border-dashed border-[#E5E7EB] px-4 py-6 text-center">
                  <p className="text-sm font-medium text-[#172033]">
                    No description
                  </p>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Add context from Task Details on the right.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <TaskReviewPanel {...workflowProps} />
          <TaskWorkPanel {...workflowProps} />

          <Card className={workspaceCard}>
            <CardHeader>
              <CardTitle className="text-[18px]">Reference files</CardTitle>
              <CardDescription>
                Briefing attachments. Assignee uploads appear in Work Submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {referenceFiles.length ? (
                <ul className="space-y-2">
                  {referenceFiles.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
                        onClick={() =>
                          void downloadFile(file.id, file.originalName)
                        }
                      >
                        <span className="truncate font-medium">
                          {file.originalName}
                        </span>
                        <span className="text-xs text-[#64748B]">
                          {Math.round(file.sizeBytes / 1024)} KB
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-[#E5E7EB] px-4 py-6 text-center">
                  <p className="text-sm font-medium text-[#172033]">
                    No reference files
                  </p>
                  <p className="mt-1 text-sm text-[#64748B]">
                    No files have been attached to this task.
                  </p>
                </div>
              )}
              {canEditDetails ? (
                <label className="inline-flex">
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void upload.mutateAsync({
                          file,
                          attach: { taskId: task.id },
                        });
                      }
                      event.target.value = "";
                    }}
                  />
                  <Button type="button" variant="outline" asChild>
                    <span>{upload.isPending ? "Uploading…" : "Upload file"}</span>
                  </Button>
                </label>
              ) : null}
            </CardContent>
          </Card>

          <TaskCommentsSection
            workspaceId={task.workspaceId}
            taskId={task.id}
            canWrite={canWrite}
          />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4">
          <Card className={workspaceCard}>
            <CardHeader>
              <CardTitle className="text-[18px]">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <MetaRow
                icon={User}
                label="Assignee"
                value={
                  (task.assigneeWork ?? []).length > 1 ? (
                    <ul className="space-y-1">
                      {(task.assigneeWork ?? []).map((person) => (
                        <li
                          key={person.userId}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>{person.name}</span>
                          <StatusBadge value={person.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    assigneeLabel
                  )
                }
              />
              <MetaRow
                icon={User}
                label="Collaborators"
                value={
                  (task.collaborators ?? []).length
                    ? (task.collaborators ?? [])
                        .map((person) => person.name)
                        .join(", ")
                    : "None"
                }
              />
              <MetaRow
                icon={User}
                label="Watchers"
                value={
                  (task.watchers ?? []).length
                    ? (task.watchers ?? []).map((person) => person.name).join(", ")
                    : "None"
                }
              />
              <MetaRow
                icon={Flag}
                label="Priority"
                value={<StatusBadge value={task.priority} />}
              />
              <MetaRow
                icon={CheckSquare}
                label="Status"
                value={
                  <div>
                    <StatusBadge value={task.status} />
                    <p className="mt-1 text-xs text-[#64748B]">
                      Updates from start, submit, and review
                    </p>
                  </div>
                }
              />
              <MetaRow
                icon={FolderKanban}
                label="Project"
                value={
                  task.project ? (
                    <Link
                      href={`/app/projects/${task.project.id}`}
                      className="hover:text-primary"
                    >
                      {task.project.name}
                    </Link>
                  ) : (
                    "No project"
                  )
                }
              />
              <MetaRow
                icon={Calendar}
                label="Start date"
                value={formatDate(task.startDate)}
              />
              <MetaRow
                icon={Calendar}
                label="Due date"
                value={formatDate(task.dueDate)}
              />
              <MetaRow
                icon={Calendar}
                label="Created"
                value={formatDate(task.createdAt)}
              />
            </CardContent>
          </Card>

          {canEditDetails ? (
          <Card className={workspaceCard}>
            <CardHeader>
              <CardTitle className="text-[18px]">Edit details</CardTitle>
              <CardDescription>
                Status changes through start, submit, and approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={save}>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    disabled={!canEditDetails}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className={nativeTextareaClass}
                    value={description}
                    disabled={!canEditDetails}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    className={nativeSelectClass}
                    value={priority}
                    disabled={!canEditDetails}
                    onChange={(event) =>
                      setPriority(event.target.value as Priority)
                    }
                  >
                    {PRIORITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    disabled={!canEditDetails}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dueDate">Due date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    disabled={!canEditDetails}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estimatedHours">Estimated hours</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    min={0}
                    max={1000}
                    step={0.25}
                    value={estimatedHours}
                    disabled={!canEditDetails}
                    onChange={(event) => setEstimatedHours(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recurrence">Recurrence</Label>
                  <select
                    id="recurrence"
                    className={nativeSelectClass}
                    value={recurrence}
                    disabled={!canEditDetails}
                    onChange={(event) => setRecurrence(event.target.value)}
                  >
                    <option value="">None</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project">Project</Label>
                  {projects.isLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <select
                      id="project"
                      className={nativeSelectClass}
                      value={projectId}
                      disabled={!canEditDetails}
                      onChange={(event) => setProjectId(event.target.value)}
                    >
                      <option value="">No project</option>
                      {(projects.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Blocked by</Label>
                  {dependencyOptions.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                      {Array.from(
                        new Map(
                          [
                            ...task.dependsOn,
                            ...(dependencyOptions.data?.items ?? []),
                          ]
                            .filter((item) => item.id !== task.id)
                            .map((item) => [item.id, item]),
                        ).values(),
                      ).map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={dependsOnTaskIds.includes(item.id)}
                            disabled={!canEditDetails}
                            onChange={(event) => {
                              setDependsOnTaskIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              );
                            }}
                          />
                          {item.title}
                        </label>
                      ))}
                      {(dependencyOptions.data?.items ?? []).length === 0 &&
                      task.dependsOn.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No other tasks loaded yet.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Blocks</Label>
                  {dependencyOptions.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                      {Array.from(
                        new Map(
                          [
                            ...(task.blocks ?? []),
                            ...(dependencyOptions.data?.items ?? []),
                          ]
                            .filter((item) => item.id !== task.id)
                            .map((item) => [item.id, item]),
                        ).values(),
                      ).map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={blocksTaskIds.includes(item.id)}
                            disabled={!canEditDetails}
                            onChange={(event) => {
                              setBlocksTaskIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              );
                            }}
                          />
                          {item.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="milestone">Milestone</Label>
                  <select
                    id="milestone"
                    className={nativeSelectClass}
                    value={milestoneId}
                    disabled={!canEditDetails || !projectId}
                    onChange={(event) => setMilestoneId(event.target.value)}
                  >
                    <option value="">None</option>
                    {(milestones.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={updateTask.isPending}>
                  Save
                </Button>
                {updateTask.error ? (
                  <p className="text-sm text-destructive">
                    {updateTask.error.message}
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>
          ) : null}

          {canEditDetails ? (
          <Card className={workspaceCard}>
            <CardHeader>
              <CardTitle className="text-[18px]">People</CardTitle>
              <CardDescription>
                Assignee completes the work. Collaborators help. Watchers get updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleReassign}>
                <PeoplePicker
                  label="Assignees"
                  hint="Search people or teams. The first selected person is primary."
                  people={(members.data ?? []).map((member) => ({
                    userId: member.userId,
                    name: member.user.name,
                  }))}
                  teams={teams.data ?? []}
                  selectedIds={assigneeIds}
                  onChange={setAssigneeIds}
                  loading={members.isLoading || teams.isLoading}
                  disabled={!canEditDetails}
                />
                <PeoplePicker
                  label="Collaborators"
                  people={(members.data ?? []).map((member) => ({
                    userId: member.userId,
                    name: member.user.name,
                  }))}
                  teams={teams.data ?? []}
                  selectedIds={collaboratorIds}
                  onChange={setCollaboratorIds}
                  loading={members.isLoading || teams.isLoading}
                  disabled={!canEditDetails}
                />
                <PeoplePicker
                  label="Watchers"
                  people={(members.data ?? []).map((member) => ({
                    userId: member.userId,
                    name: member.user.name,
                  }))}
                  teams={teams.data ?? []}
                  selectedIds={watcherIds}
                  onChange={setWatcherIds}
                  loading={members.isLoading || teams.isLoading}
                  disabled={!canEditDetails}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={assignTask.isPending}
                >
                  Save people
                </Button>
              </form>
              {assignTask.error ? (
                <p className="mt-2 text-sm text-destructive">
                  {assignTask.error.message}
                </p>
              ) : null}
            </CardContent>
          </Card>
          ) : null}

          {canDelete ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteTask.isPending}
            >
              Delete
            </Button>
          ) : null}
        </aside>
      </div>

      <CreateResourceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this task?"
        description="This cannot be undone."
      >
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteTask.isPending}
            onClick={() => {
              void deleteTask.mutateAsync(taskId).then(() => {
                router.push("/app/tasks");
              });
            }}
          >
            {deleteTask.isPending ? "Deleting…" : "Delete task"}
          </Button>
        </div>
      </CreateResourceDialog>
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        visibility={task.visibility ?? "WORKSPACE"}
        members={(members.data ?? [])
          .filter(
            (member) =>
              member.userId !== userId &&
              !(task.shares ?? []).some((share) => share.userId === member.userId),
          )
          .map((member) => ({
            userId: member.userId,
            name: member.user.name,
          }))}
        shares={task.shares ?? []}
        link={
          typeof window === "undefined"
            ? ""
            : `${window.location.origin}/app/tasks/${task.id}`
        }
        onVisibility={(visibility) => {
          void shareTask.setVisibility.mutateAsync(visibility);
        }}
        onShare={async (userId, permission) => {
          await shareTask.share.mutateAsync({ userId, permission });
        }}
        onUnshare={async (userId) => {
          await shareTask.unshare.mutateAsync(userId);
        }}
      />
    </PageShell>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" />
      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-wide text-[#64748B]">
          {label}
        </p>
        <div className="mt-1 font-medium text-[#172033]">{value}</div>
      </div>
    </div>
  );
}
