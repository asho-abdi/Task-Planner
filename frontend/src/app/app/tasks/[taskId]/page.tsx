"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CircleDot,
  Clock,
  Eye,
  FileSearch,
  Flag,
  FolderKanban,
  Globe,
  Lock,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Repeat,
  Share2,
  Target,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { PageShell } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
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
  FileCard,
  TaskActivityTimeline,
  TaskCommentsSection,
  TaskNotices,
  TaskReviewPanel,
  TaskWorkActions,
} from "@/features/tasks/task-workflow";
import { ProjectChip, TaskDue, dueInfo } from "@/features/tasks/task-meta";
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
import {
  cn,
  formatDate,
  fromDateInputValue,
  nativeSelectClass,
  nativeTextareaClass,
  toDateInputValue,
} from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const VISIBILITY_META = {
  PRIVATE: { label: "Private", icon: Lock },
  PROJECT: { label: "Project members", icon: FolderKanban },
  WORKSPACE: { label: "Workspace", icon: Globe },
} as const;

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const task = useTask(workspaceId, params.taskId);
  const projects = useProjects(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const dependencyOptions = useTasks(workspaceId, { page: 1, pageSize: 50 });
  const currentUser = useCurrentUser();

  if (task.isLoading) {
    return <TaskDetailSkeleton />;
  }

  if (!task.data) {
    return (
      <PageShell width="wide">
        <Breadcrumbs items={[{ label: "Tasks", href: "/app/tasks" }, { label: "Not found" }]} />
        {task.isError ? (
          <ErrorState
            title="Couldn't load this task"
            description={task.error.message}
            action={
              <Button variant="outline" size="sm" onClick={() => void task.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <EmptyState
          icon={FileSearch}
          title="Task not found"
          description="It may have been deleted, or you no longer have access."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/tasks">Back to tasks</Link>
            </Button>
          }
        />
      </PageShell>
    );
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

function TaskDetailSkeleton() {
  return (
    <PageShell width="wide">
      <div role="status" aria-label="Loading task" className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-40" />
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-8 w-80 max-w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-md" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="space-y-3 rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
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
  const [editOpen, setEditOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
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
  const memberOptions = (members.data ?? []).map((member) => ({
    userId: member.userId,
    name: member.user.name,
  }));
  const visibility = VISIBILITY_META[task.visibility ?? "WORKSPACE"];
  const due = dueInfo(task.dueDate, task.status);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
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
      toast.success("Task updated");
      setEditOpen(false);
    } catch {
      // Error is shown in the form and toasted globally.
    }
  }

  async function handleReassign(event: FormEvent) {
    event.preventDefault();
    try {
      await assignTask.mutateAsync({
        assigneeIds,
        collaboratorIds,
        watcherIds,
      });
      toast.success("People updated");
      setPeopleOpen(false);
    } catch {
      // Error is shown in the form and toasted globally.
    }
  }

  const dependencyList = (selected: Array<{ id: string; title: string }>) =>
    Array.from(
      new Map(
        [...selected, ...(dependencyOptions.data?.items ?? [])]
          .filter((item) => item.id !== task.id)
          .map((item) => [item.id, item]),
      ).values(),
    );

  return (
    <PageShell width="wide">
      <header className="space-y-3">
        <Breadcrumbs
          items={[
            { label: "Tasks", href: "/app/tasks" },
            { label: task.title },
          ]}
        />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <h1 className="break-words font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-3xl">
              {task.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={task.status} />
              <PriorityBadge value={task.priority} />
              {task.project ? <ProjectChip project={task.project} link /> : null}
              {task.dueDate ? (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Due <TaskDue task={task} showIcon={false} />
                </span>
              ) : null}
              {task.blocked ? (
                <Badge variant="warning">
                  <Lock />
                  Blocked
                </Badge>
              ) : null}
              {task.meeting ? (
                <Link
                  href={`/app/meetings/${task.meeting.id}`}
                  className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Video className="size-3.5" aria-hidden />
                  From meeting {task.meeting.title}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <TaskWorkActions {...workflowProps} />
            {canEditDetails ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
            {canEditDetails ? (
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                <Share2 />
                Share
              </Button>
            ) : null}
            {canDelete ? (
              <DropdownMenu>
                <Tooltip content="More actions">
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={deleteTask.isPending}
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2 />
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      <TaskNotices task={task} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Description</CardTitle>
                {canEditDetails ? (
                  <Button variant="ghost" size="xs" onClick={() => setEditOpen(true)}>
                    <Pencil />
                    Edit
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
                  {task.description}
                </p>
              ) : (
                <p className="text-base text-subtle-foreground">
                  No description yet.
                  {canEditDetails ? " Use Edit to add context for the assignee." : ""}
                </p>
              )}
            </CardContent>
          </Card>

          <TaskReviewPanel {...workflowProps} />

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Reference files</CardTitle>
                  <CardDescription>
                    Briefing attachments. Assignee uploads appear in Submissions.
                  </CardDescription>
                </div>
                {canEditDetails ? (
                  <label className="shrink-0">
                    <input
                      type="file"
                      className="peer sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void upload
                            .mutateAsync({
                              file,
                              attach: { taskId: task.id },
                            })
                            .then(() => toast.success("File uploaded"))
                            .catch(() => undefined);
                        }
                        event.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                    >
                      <span>
                        <Upload />
                        {upload.isPending ? "Uploading…" : "Upload"}
                      </span>
                    </Button>
                  </label>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {referenceFiles.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {referenceFiles.map((file) => (
                    <FileCard key={file.id} file={file} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={Paperclip}
                  title="No reference files"
                  description="No files have been attached to this task."
                  className="rounded-lg border border-dashed border-border py-6"
                />
              )}
            </CardContent>
          </Card>

          <TaskCommentsSection
            workspaceId={task.workspaceId}
            taskId={task.id}
            canWrite={canWrite}
          />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 pb-3">
              <PropRow icon={CircleDot} label="Status">
                <span title="Updates from start, submit, and review">
                  <StatusBadge value={task.status} />
                </span>
              </PropRow>
              <PropRow icon={Flag} label="Priority">
                <PriorityBadge value={task.priority} />
              </PropRow>
              <PropRow icon={FolderKanban} label="Project">
                <ProjectChip project={task.project} link />
              </PropRow>
              {task.milestone ? (
                <PropRow icon={Target} label="Milestone">
                  <span className="truncate">{task.milestone.title}</span>
                </PropRow>
              ) : null}
              <PropRow icon={CalendarDays} label="Start">
                {task.startDate ? formatDate(task.startDate) : <Muted>Not set</Muted>}
              </PropRow>
              <PropRow icon={CalendarDays} label="Due">
                {task.dueDate ? (
                  <span
                    className={cn(
                      "tabular",
                      due?.overdue && "font-medium text-danger-soft-foreground",
                    )}
                  >
                    {formatDate(task.dueDate)}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {due?.label}
                    </span>
                  </span>
                ) : (
                  <Muted>Not set</Muted>
                )}
              </PropRow>
              <PropRow icon={Clock} label="Estimate">
                {task.estimatedHours != null ? (
                  <span className="tabular">{task.estimatedHours}h</span>
                ) : (
                  <Muted>Not set</Muted>
                )}
              </PropRow>
              {task.recurrence ? (
                <PropRow icon={Repeat} label="Repeats">
                  {RECURRENCE_LABELS[task.recurrence] ?? task.recurrence}
                </PropRow>
              ) : null}
              <PropRow icon={visibility.icon} label="Visibility">
                <span className="flex items-center gap-2">
                  {visibility.label}
                  {canEditDetails ? (
                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Change
                    </button>
                  ) : null}
                </span>
              </PropRow>
              <PropRow icon={CalendarPlus} label="Created">
                {formatDate(task.createdAt)}
              </PropRow>
            </CardContent>
            <div className="border-t border-border px-5 pb-4 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">People</p>
                {canEditDetails ? (
                  <Button variant="ghost" size="xs" onClick={() => setPeopleOpen(true)}>
                    <Users />
                    Manage
                  </Button>
                ) : null}
              </div>
              <div className="space-y-3">
                <PeopleGroup label="Assignees">
                  {(task.assigneeWork ?? []).length > 1 ? (
                    <ul className="space-y-1.5">
                      {(task.assigneeWork ?? []).map((person) => (
                        <li
                          key={person.userId}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar name={person.name} size="xs" />
                            <span className="truncate text-sm text-foreground">
                              {person.name}
                            </span>
                          </span>
                          <StatusBadge value={person.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <PersonList people={assignees} empty="Unassigned" />
                  )}
                </PeopleGroup>
                <PeopleGroup label="Collaborators">
                  <PersonList people={task.collaborators ?? []} empty="None" />
                </PeopleGroup>
                <PeopleGroup label="Watchers">
                  {(task.watchers ?? []).length > 3 ? (
                    <span title={(task.watchers ?? []).map((p) => p.name).join(", ")}>
                      <AvatarStack people={task.watchers ?? []} max={6} size="xs" />
                    </span>
                  ) : (
                    <PersonList people={task.watchers ?? []} empty="None" />
                  )}
                </PeopleGroup>
              </div>
            </div>
          </Card>

          <TaskActivityTimeline task={task} />
        </aside>
      </div>

      {canEditDetails ? (
        <CreateResourceDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Edit task"
          description="Status changes through start, submit, and approval."
          className="max-w-2xl"
        >
          <form className="space-y-5" onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  disabled={!canEditDetails}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className={nativeTextareaClass}
                  value={description}
                  disabled={!canEditDetails}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-2">
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
                      {PRIORITY_LABELS[item] ?? item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  disabled={!canEditDetails}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  disabled={!canEditDetails}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
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
              <div className="space-y-2 sm:col-span-2">
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
              <div className="space-y-2">
                <Label>Blocked by</Label>
                {dependencyOptions.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <CheckList
                    items={dependencyList(task.dependsOn)}
                    selected={dependsOnTaskIds}
                    disabled={!canEditDetails}
                    onChange={setDependsOnTaskIds}
                    empty={
                      (dependencyOptions.data?.items ?? []).length === 0 &&
                      task.dependsOn.length === 0
                        ? "No other tasks loaded yet."
                        : null
                    }
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Blocks</Label>
                {dependencyOptions.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <CheckList
                    items={dependencyList(task.blocks ?? [])}
                    selected={blocksTaskIds}
                    disabled={!canEditDetails}
                    onChange={setBlocksTaskIds}
                    empty={null}
                  />
                )}
              </div>
            </div>
            {updateTask.error ? (
              <p className="text-sm text-danger-soft-foreground">
                {updateTask.error.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={updateTask.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CreateResourceDialog>
      ) : null}

      {canEditDetails ? (
        <CreateResourceDialog
          open={peopleOpen}
          onOpenChange={setPeopleOpen}
          title="People"
          description="Assignees complete the work. Collaborators help. Watchers get updates."
          className="max-w-xl"
        >
          <form className="space-y-5" onSubmit={handleReassign}>
            <PeoplePicker
              label="Assignees"
              hint="Search people or teams. The first selected person is primary."
              people={memberOptions}
              teams={teams.data ?? []}
              selectedIds={assigneeIds}
              onChange={setAssigneeIds}
              loading={members.isLoading || teams.isLoading}
              disabled={!canEditDetails}
            />
            <PeoplePicker
              label="Collaborators"
              people={memberOptions}
              teams={teams.data ?? []}
              selectedIds={collaboratorIds}
              onChange={setCollaboratorIds}
              loading={members.isLoading || teams.isLoading}
              disabled={!canEditDetails}
            />
            <PeoplePicker
              label="Watchers"
              people={memberOptions}
              teams={teams.data ?? []}
              selectedIds={watcherIds}
              onChange={setWatcherIds}
              loading={members.isLoading || teams.isLoading}
              disabled={!canEditDetails}
            />
            {assignTask.error ? (
              <p className="text-sm text-danger-soft-foreground">
                {assignTask.error.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setPeopleOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={assignTask.isPending}>
                Save people
              </Button>
            </div>
          </form>
        </CreateResourceDialog>
      ) : null}

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
            loading={deleteTask.isPending}
            onClick={() => {
              void deleteTask
                .mutateAsync(taskId)
                .then(() => {
                  toast.success("Task deleted");
                  router.push("/app/tasks");
                })
                .catch(() => undefined);
            }}
          >
            <Trash2 />
            Delete task
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
        onVisibility={(nextVisibility) => {
          void shareTask.setVisibility
            .mutateAsync(nextVisibility)
            .then(() => toast.success("Visibility updated"))
            .catch(() => undefined);
        }}
        onShare={async (shareUserId, permission) => {
          await shareTask.share.mutateAsync({ userId: shareUserId, permission });
          toast.success("Task shared");
        }}
        onUnshare={async (shareUserId) => {
          await shareTask.unshare.mutateAsync(shareUserId);
          toast.success("Access removed");
        }}
        sharing={shareTask.share.isPending}
      />
    </PageShell>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-subtle-foreground">{children}</span>;
}

function PropRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Eye;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center gap-3 text-sm">
      <span className="flex w-24 shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center text-foreground">{children}</div>
    </div>
  );
}

function PeopleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function PersonList({
  people,
  empty,
}: {
  people: Array<{ id: string; name: string }>;
  empty: string;
}) {
  if (!people.length) return <p className="text-sm text-subtle-foreground">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {people.map((person) => (
        <li key={person.id} className="flex min-w-0 items-center gap-2">
          <Avatar name={person.name} size="xs" />
          <span className="truncate text-sm text-foreground">{person.name}</span>
        </li>
      ))}
    </ul>
  );
}

function CheckList({
  items,
  selected,
  disabled,
  onChange,
  empty,
}: {
  items: Array<{ id: string; title: string }>;
  selected: string[];
  disabled: boolean;
  onChange: (updater: (current: string[]) => string[]) => void;
  empty: string | null;
}) {
  return (
    <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
      {items.map((item) => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <input
            type="checkbox"
            className="size-3.5 shrink-0 accent-primary"
            checked={selected.includes(item.id)}
            disabled={disabled}
            onChange={(event) => {
              const checked = event.target.checked;
              onChange((current) =>
                checked
                  ? [...current, item.id]
                  : current.filter((id) => id !== item.id),
              );
            }}
          />
          <span className="truncate">{item.title}</span>
        </label>
      ))}
      {empty ? <p className="px-2 py-1.5 text-sm text-muted-foreground">{empty}</p> : null}
    </div>
  );
}
