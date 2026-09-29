"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Download,
  FileText,
  FolderX,
  ListTodo,
  Pause,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import {
  EmptyState,
  ListPanel,
  PageShell,
  SectionTitle,
} from "@/components/page-header";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  useArchiveProject,
  useDeleteProject,
  useProject,
  useSaveProjectTemplate,
  useUpdateProject,
} from "@/features/projects/hooks";
import {
  ProjectHeader,
  ProjectTabs,
  type ProjectTab,
} from "@/features/projects/project-hub";
import {
  PRIORITIES,
  type Priority,
  type Project,
} from "@/features/projects/types";
import { useTasks } from "@/features/tasks/hooks";
import type { Task } from "@/features/tasks/types";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { useWorkspaceMembers } from "@/features/workspaces/hooks";
import {
  useAssignProject,
  useFiles,
  useProjectAssignmentActions,
  useProjectAssignments,
  useRemoveProjectMember,
  useTeams,
  useUpdateProjectMemberRole,
  useUploadFile,
} from "@/features/collaboration/hooks";
import { downloadFile } from "@/features/collaboration/api";
import { ProjectChat } from "@/features/chat/chat-ui";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  cn,
  formatDate,
  formatRelativeTime,
  fromDateInputValue,
  nativeSelectClass,
  nativeTextareaClass,
  toDateInputValue,
} from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { AiPlanDialog } from "@/features/ai/ui";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useMeetings } from "@/features/meetings/hooks";
import { MeetingCard, TeamCalendar } from "@/features/meetings/meeting-ui";
import {
  ProjectMilestonesPanel,
  ProjectNotesPanel,
} from "@/features/projects/project-planning";

const PROJECT_ROLES = ["OWNER", "MANAGER", "MEMBER", "VIEWER"] as const;
const BOARD_COLUMNS = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RETURNED",
  "OVERDUE",
  "COMPLETED",
] as const;

function roleLabel(role: string) {
  return `${role[0]}${role.slice(1).toLowerCase()}`;
}

function isTaskOverdue(task: Task) {
  if (task.status === "OVERDUE") return true;
  if (!task.dueDate || task.status === "COMPLETED" || task.status === "ARCHIVED") {
    return false;
  }
  return new Date(task.dueDate).getTime() < Date.now();
}

function taskPeople(task: Task) {
  if ((task.assignees ?? []).length) return task.assignees;
  return task.assignee ? [task.assignee] : [];
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const project = useProject(workspaceId, params.projectId);
  const tasks = useTasks(workspaceId, {
    projectId: params.projectId,
    pageSize: 50,
  });

  if (project.isLoading) {
    return (
      <PageShell width="wide">
        <div role="status" aria-label="Loading project" className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!project.data) {
    return (
      <PageShell width="wide">
        {project.isError ? (
          <ErrorState
            title="Couldn't load this project"
            description={project.error.message}
            action={
              <Button size="sm" variant="outline" onClick={() => void project.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={FolderX}
            title="Project not found"
            description="It may have been archived, deleted, or you no longer have access."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/app/projects">Back to projects</Link>
              </Button>
            }
          />
        )}
      </PageShell>
    );
  }

  return (
    <ProjectDetail
      key={project.data.updatedAt}
      project={project.data}
      tasks={tasks}
    />
  );
}

function projectCanEdit(project: Project, workspaceRole?: string) {
  if (project.myAccess) {
    return (
      project.myAccess === "EDIT" ||
      project.myAccess === "MANAGE" ||
      project.myAccess === "OWN"
    );
  }
  return Boolean(workspaceRole && workspaceRole !== "VIEWER");
}

function projectCanManage(project: Project, workspaceRole?: string) {
  if (project.myAccess) {
    return project.myAccess === "MANAGE" || project.myAccess === "OWN";
  }
  return Boolean(workspaceRole && workspaceRole !== "VIEWER");
}

function ProjectDetail({
  project,
  tasks,
}: {
  project: Project;
  tasks: ReturnType<typeof useTasks>;
}) {
  const router = useRouter();
  const workspace = useCurrentWorkspace();
  const projectId = project.id;
  const updateProject = useUpdateProject(projectId);
  const archiveProject = useArchiveProject();
  const deleteProject = useDeleteProject();
  const saveTemplate = useSaveProjectTemplate(projectId);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const openMeetingCreate = useUiStore((state) => state.openMeetingCreate);
  const canWrite = projectCanEdit(project, workspace?.role);
  const canManage = projectCanManage(project, workspace?.role);
  const canDelete =
    workspace?.role === "OWNER" || workspace?.role === "ADMIN";
  const members = useWorkspaceMembers(project.workspaceId);
  const teams = useTeams(project.workspaceId);
  const assignments = useProjectAssignments(project.workspaceId, projectId);
  const assignProject = useAssignProject(projectId);
  const updateMemberRole = useUpdateProjectMemberRole(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const assignmentActions = useProjectAssignmentActions(projectId);
  const currentUser = useCurrentUser();
  const files = useFiles(project.workspaceId, { projectId });
  const myAssignment = (assignments.data ?? []).find(
    (item) => item.userId === currentUser.data?.id,
  );
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] =
    useState<(typeof PROJECT_ROLES)[number]>("MEMBER");
  const [tab, setTab] = useState<ProjectTab>("overview");

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [icon, setIcon] = useState(project.icon ?? "");
  const [priority, setPriority] = useState<Priority>(project.priority);
  const [teamId, setTeamId] = useState(project.teamId ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(project.startDate));
  const [endDate, setEndDate] = useState(
    toDateInputValue(project.dueDate ?? project.endDate),
  );
  const [planOpen, setPlanOpen] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    await updateProject.mutateAsync({
      name,
      description: description.trim() || null,
      icon: icon.trim() || null,
      priority,
      teamId: teamId || null,
      startDate: fromDateInputValue(startDate) ?? null,
      endDate: fromDateInputValue(endDate) ?? null,
    });
    toast.success("Project updated");
  }

  async function handleArchive() {
    await archiveProject.mutateAsync(projectId);
    toast.success("Project archived");
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this archived project? Tasks stay in the workspace and are detached.",
      )
    ) {
      return;
    }
    await deleteProject.mutateAsync(projectId);
    toast.success("Project deleted");
    router.push("/app/projects");
  }

  const taskItems = tasks.data?.items ?? [];

  return (
    <PageShell width="wide">
      <ProjectHeader
        project={project}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
              <Sparkles />
              Plan
            </Button>
            {canWrite ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  loading={saveTemplate.isPending}
                  onClick={() =>
                    void saveTemplate
                      .mutateAsync(undefined)
                      .then(() => toast.success("Saved as template"))
                      .catch(() => undefined)
                  }
                >
                  <Save />
                  Save as template
                </Button>
                <Button size="sm" onClick={() => openTaskCreate(projectId)}>
                  <Plus />
                  New task
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <ProjectTabs value={tab} onChange={setTab} />

      {tab === "overview" ? (
        <div className="grid gap-6 animate-fade-in lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Details</CardTitle>
                <CardDescription>Updates stay inside this workspace.</CardDescription>
              </CardHeader>
              <form onSubmit={save}>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 grid-cols-[72px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label htmlFor="icon">Icon</Label>
                      <Input
                        id="icon"
                        value={icon}
                        className="text-center"
                        onChange={(event) => setIcon(event.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      className={nativeTextareaClass}
                      value={description}
                      placeholder="What is this project about?"
                      onChange={(event) => setDescription(event.target.value)}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="flex min-h-9 items-center gap-2">
                        <StatusBadge value={project.status} />
                        {canManage && project.status !== "ARCHIVED" ? (
                          project.status === "ON_HOLD" ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              loading={updateProject.isPending}
                              onClick={() =>
                                void updateProject
                                  .mutateAsync({ status: "ACTIVE" })
                                  .then(() => toast.success("Project resumed"))
                                  .catch(() => undefined)
                              }
                            >
                              <Play />
                              Resume
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              loading={updateProject.isPending}
                              onClick={() =>
                                void updateProject
                                  .mutateAsync({ status: "ON_HOLD" })
                                  .then(() => toast.success("Project put on hold"))
                                  .catch(() => undefined)
                              }
                            >
                              <Pause />
                              Put on hold
                            </Button>
                          )
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Updates on its own from the start date and task progress.
                        Archive is still a separate action.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <select
                        id="priority"
                        className={nativeSelectClass}
                        value={priority}
                        disabled={!canManage}
                        onChange={(event) =>
                          setPriority(event.target.value as Priority)
                        }
                      >
                        {PRIORITIES.map((item) => (
                          <option key={item} value={item}>
                            {roleLabel(item)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team">Team</Label>
                      <select
                        id="team"
                        className={nativeSelectClass}
                        value={teamId}
                        disabled={!canManage}
                        onChange={(event) => setTeamId(event.target.value)}
                      >
                        <option value="">No team</option>
                        {(teams.data ?? []).map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate}
                          disabled={!canManage}
                          onChange={(event) => setStartDate(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">Due</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={endDate}
                          disabled={!canManage}
                          onChange={(event) => setEndDate(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  {updateProject.error ? (
                    <p className="text-sm text-danger-soft-foreground">
                      {updateProject.error.message}
                    </p>
                  ) : null}
                </CardContent>
                {canManage ? (
                  <CardFooter className="flex-wrap justify-between">
                    {project.status !== "ARCHIVED" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleArchive()}
                        loading={archiveProject.isPending}
                      >
                        <Archive />
                        Archive
                      </Button>
                    ) : canDelete ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleDelete()}
                        loading={deleteProject.isPending}
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button type="submit" size="sm" loading={updateProject.isPending}>
                      Save changes
                    </Button>
                  </CardFooter>
                ) : null}
              </form>
            </Card>

            <section className="space-y-3">
              <SectionTitle description="Checkpoints for this project. Link tasks to them from the task page.">
                Milestones
              </SectionTitle>
              <ProjectMilestonesPanel projectId={projectId} canWrite={canWrite} />
            </section>

            <ProjectMembersCard
              assignments={assignments.data ?? []}
              members={members.data ?? []}
              canManage={canManage}
              assignUserId={assignUserId}
              assignRole={assignRole}
              onAssignUserId={setAssignUserId}
              onAssignRole={setAssignRole}
              assigning={assignProject.isPending}
              onAssign={() => {
                if (assignUserId) {
                  void assignProject
                    .mutateAsync({
                      userId: assignUserId,
                      role: assignRole,
                    })
                    .then(() => toast.success("Member assigned"))
                    .catch(() => undefined);
                }
              }}
              onRole={(userId, role) =>
                void updateMemberRole
                  .mutateAsync({ userId, role })
                  .then(() => toast.success("Role updated"))
                  .catch(() => undefined)
              }
              onRemove={(userId) =>
                void removeMember
                  .mutateAsync(userId)
                  .then(() => toast.success("Member removed"))
                  .catch(() => undefined)
              }
              myAssignment={myAssignment}
              assignmentActions={assignmentActions}
            />
          </div>
          <ProjectSummary
            project={project}
            tasks={tasks}
            fileCount={files.data?.length}
            memberCount={(assignments.data ?? []).length}
            onTab={setTab}
          />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <section className="space-y-3 animate-fade-in">
          <SectionTitle
            description="Each task can go to different people, and one task can have several assignees."
            action={
              canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openTaskCreate(projectId)}
                >
                  <Plus />
                  Add task
                </Button>
              ) : null
            }
          >
            Tasks
          </SectionTitle>
          <TaskList
            tasks={tasks}
            canWrite={canWrite}
            onAdd={() => openTaskCreate(projectId)}
          />
        </section>
      ) : null}

      {tab === "board" ? (
        <ProjectBoard tasks={taskItems} loading={tasks.isLoading} />
      ) : null}

      {tab === "files" ? (
        <ProjectFiles
          files={files}
          canWrite={canWrite}
          projectId={projectId}
        />
      ) : null}

      {tab === "meetings" ? (
        <ProjectMeetings
          projectId={project.id}
          canWrite={canWrite}
          onCreate={() => openMeetingCreate(projectId)}
        />
      ) : null}

      {tab === "chat" ? (
        <div className="animate-fade-in">
          <ProjectChat projectId={project.id} canWrite={Boolean(canWrite)} />
        </div>
      ) : null}

      {tab === "calendar" ? (
        <section className="space-y-3 animate-fade-in">
          <SectionTitle description="Meetings, deadlines, and milestones for this project.">
            Calendar
          </SectionTitle>
          <TeamCalendar
            workspaceId={project.workspaceId}
            projectId={projectId}
          />
        </section>
      ) : null}

      {tab === "notes" ? (
        <div className="animate-fade-in">
          <ProjectNotesPanel
            projectId={projectId}
            projectName={project.name}
            canWrite={canWrite}
          />
        </div>
      ) : null}

      <AiPlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        projectId={projectId}
        canWrite={Boolean(canWrite)}
      />
    </PageShell>
  );
}

function ProjectSummary({
  project,
  tasks,
  fileCount,
  memberCount,
  onTab,
}: {
  project: Project;
  tasks: ReturnType<typeof useTasks>;
  fileCount?: number;
  memberCount: number;
  onTab: (tab: ProjectTab) => void;
}) {
  const items = tasks.data?.items ?? [];
  const completed = items.filter((task) => task.status === "COMPLETED").length;
  const overdue = items.filter(isTaskOverdue).length;
  const inProgress = items.filter(
    (task) => task.status === "IN_PROGRESS" || task.status === "IN_REVIEW",
  ).length;
  const upcoming = items
    .filter(
      (task) =>
        task.dueDate && task.status !== "COMPLETED" && task.status !== "ARCHIVED",
    )
    .sort(
      (a, b) =>
        new Date(a.dueDate as string).getTime() -
        new Date(b.dueDate as string).getTime(),
    )
    .slice(0, 4);

  const stats = [
    { label: "Total tasks", value: tasks.data?.total ?? items.length, icon: ListTodo, tone: "bg-muted text-muted-foreground" },
    { label: "In progress", value: inProgress, icon: CircleDot, tone: "bg-info-soft text-info-soft-foreground" },
    { label: "Completed", value: completed, icon: CheckCircle2, tone: "bg-success-soft text-success-soft-foreground" },
    { label: "Overdue", value: overdue, icon: TriangleAlert, tone: overdue ? "bg-danger-soft text-danger-soft-foreground" : "bg-muted text-muted-foreground" },
  ];

  return (
    <aside className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Updated {formatRelativeTime(project.updatedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tasks.isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md",
                        stat.tone,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <p className="mt-2 font-heading text-xl font-semibold text-foreground tabular">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          )}
          <dl className="space-y-2.5 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-3.5" />
                Members
              </dt>
              <dd className="font-medium text-foreground tabular">{memberCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <FileText className="size-3.5" />
                Files
              </dt>
              <dd className="font-medium text-foreground tabular">
                {fileCount ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-3.5" />
                Created
              </dt>
              <dd className="font-medium text-foreground tabular">
                {formatDate(project.createdAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle>Upcoming deadlines</CardTitle>
          <Button variant="link" size="xs" className="h-auto p-0" onClick={() => onTab("tasks")}>
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {tasks.isLoading ? (
            <SkeletonList rows={3} className="-mx-4" />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
          ) : (
            <ul className="space-y-1">
              {upcoming.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/app/tasks/${task.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate text-foreground">{task.title}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular",
                        isTaskOverdue(task)
                          ? "text-danger-soft-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatDate(task.dueDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

function TaskList({
  tasks,
  canWrite,
  onAdd,
}: {
  tasks: ReturnType<typeof useTasks>;
  canWrite: boolean;
  onAdd: () => void;
}) {
  if (tasks.isLoading) {
    return (
      <ListPanel>
        <SkeletonList rows={5} />
      </ListPanel>
    );
  }
  if ((tasks.data?.items ?? []).length === 0) {
    return (
      <ListPanel>
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Create the first task and choose who should do it."
          action={
            canWrite ? (
              <Button size="sm" type="button" onClick={onAdd}>
                <Plus />
                Add task
              </Button>
            ) : undefined
          }
        />
      </ListPanel>
    );
  }
  return (
    <ListPanel className="divide-y divide-border">
      {(tasks.data?.items ?? []).map((task) => {
        const people = taskPeople(task);
        const assigneeNames = people.length
          ? people.map((person) => person.name).join(", ")
          : "Unassigned";
        const overdue = isTaskOverdue(task);
        return (
          <Link
            key={task.id}
            href={`/app/tasks/${task.id}`}
            className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-foreground group-hover:text-primary">
                {task.title}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{assigneeNames}</span>
                {task.dueDate ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 tabular sm:hidden",
                      overdue && "text-danger-soft-foreground",
                    )}
                  >
                    · {formatDate(task.dueDate)}
                  </span>
                ) : null}
              </span>
            </span>
            <span className="hidden md:block">
              <PriorityBadge value={task.priority} />
            </span>
            <span
              className={cn(
                "hidden w-28 shrink-0 items-center gap-1 text-xs tabular sm:inline-flex",
                overdue ? "text-danger-soft-foreground" : "text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3.5" />
              {task.dueDate ? formatDate(task.dueDate) : "No due date"}
            </span>
            {people.length ? (
              <AvatarStack
                people={people}
                max={3}
                size="xs"
                className="hidden shrink-0 sm:flex"
              />
            ) : null}
            <StatusBadge value={task.status} className="shrink-0" />
          </Link>
        );
      })}
    </ListPanel>
  );
}

function ProjectBoard({ tasks, loading }: { tasks: Task[]; loading?: boolean }) {
  return (
    <div className="grid gap-4 animate-fade-in md:grid-cols-2 xl:grid-cols-3">
      {BOARD_COLUMNS.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <section
            key={status}
            aria-label={status}
            className="flex min-h-48 flex-col rounded-xl border border-border bg-muted/40 p-2"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <StatusBadge value={status} />
              <span className="text-xs font-medium text-muted-foreground tabular">
                {columnTasks.length}
              </span>
            </div>
            <div className="mt-1 flex-1 space-y-2">
              {loading ? (
                <>
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </>
              ) : columnTasks.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-subtle-foreground">
                  No tasks
                </p>
              ) : (
                columnTasks.map((task) => {
                  const people = taskPeople(task);
                  return (
                    <Link
                      key={task.id}
                      href={`/app/tasks/${task.id}`}
                      className="block rounded-lg border border-border bg-card p-3 text-sm shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="line-clamp-2 font-medium text-foreground">
                        {task.title}
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2">
                        <PriorityBadge value={task.priority} />
                        <span className="flex items-center gap-2">
                          {task.dueDate ? (
                            <span
                              className={cn(
                                "text-xs tabular",
                                isTaskOverdue(task)
                                  ? "text-danger-soft-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatDate(task.dueDate)}
                            </span>
                          ) : null}
                          {people.length ? (
                            <AvatarStack people={people} max={2} size="xs" />
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ProjectFiles({
  files,
  canWrite,
  projectId,
}: {
  files: ReturnType<typeof useFiles>;
  canWrite: boolean;
  projectId: string;
}) {
  const upload = useUploadFile();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="space-y-3 animate-fade-in">
      <SectionTitle
        description="Files attached to this project."
        action={
          canWrite ? (
            <>
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void upload
                      .mutateAsync({ file, attach: { projectId } })
                      .then(() => toast.success("File uploaded"))
                      .catch(() => undefined);
                  }
                  event.target.value = "";
                }}
              />
              <Button
                size="sm"
                loading={upload.isPending}
                onClick={() => inputRef.current?.click()}
              >
                <Upload />
                Upload
              </Button>
            </>
          ) : null
        }
      >
        Files
      </SectionTitle>
      {upload.error ? (
        <p className="text-sm text-danger-soft-foreground">{upload.error.message}</p>
      ) : null}
      <ListPanel className="divide-y divide-border">
        {files.isLoading ? (
          <SkeletonList rows={3} />
        ) : (files.data ?? []).length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No files yet"
            description="Upload a file to keep it with this project."
          />
        ) : (
          (files.data ?? []).map((file) => (
            <button
              key={file.id}
              type="button"
              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
              onClick={() => void downloadFile(file.id, file.originalName)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-foreground">
                  {file.originalName}
                </span>
                <span className="text-xs text-muted-foreground tabular">
                  {formatFileSize(file.sizeBytes)}
                </span>
              </span>
              <Download
                aria-label="Download"
                className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              />
            </button>
          ))
        )}
      </ListPanel>
    </section>
  );
}

function ProjectMembersCard({
  assignments,
  members,
  canManage,
  assignUserId,
  assignRole,
  assigning,
  onAssignUserId,
  onAssignRole,
  onAssign,
  onRole,
  onRemove,
  myAssignment,
  assignmentActions,
}: {
  assignments: Array<{
    id: string;
    userId: string;
    status: string;
    role?: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER";
    user: { name: string };
  }>;
  members: Array<{ userId: string; user: { name: string } }>;
  canManage: boolean;
  assignUserId: string;
  assignRole: (typeof PROJECT_ROLES)[number];
  assigning?: boolean;
  onAssignUserId: (value: string) => void;
  onAssignRole: (value: (typeof PROJECT_ROLES)[number]) => void;
  onAssign: () => void;
  onRole: (
    userId: string,
    role: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER",
  ) => void;
  onRemove: (userId: string) => void;
  myAssignment?: { status: string };
  assignmentActions: ReturnType<typeof useProjectAssignmentActions>;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Project members</CardTitle>
        <CardDescription>
          Owner has full control. Manager can manage the project. Member can
          create and update tasks. Viewer is read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignments.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No members assigned"
            description="Assign workspace members to give them access."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {assignments.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={item.user.name} size="sm" title={item.user.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium text-foreground">
                      {item.user.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {roleLabel(item.status.replaceAll("_", " "))}
                    </span>
                  </span>
                </span>
                {canManage ? (
                  <span className="flex items-center gap-1.5 pl-10 sm:pl-0">
                    <select
                      aria-label={`Role for ${item.user.name}`}
                      className={cn(nativeSelectClass, "h-8 w-32 text-sm")}
                      value={item.role ?? "MEMBER"}
                      onChange={(event) =>
                        onRole(
                          item.userId,
                          event.target.value as (typeof PROJECT_ROLES)[number],
                        )
                      }
                    >
                      {PROJECT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(item.userId)}
                    >
                      Remove
                    </Button>
                  </span>
                ) : (
                  <Badge variant="outline" className="self-start sm:self-auto">
                    {roleLabel(item.role ?? "MEMBER")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              onAssign();
            }}
          >
            <select
              aria-label="Member to assign"
              className={nativeSelectClass}
              value={assignUserId}
              onChange={(event) => onAssignUserId(event.target.value)}
            >
              <option value="">Assign member</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Role"
              className={nativeSelectClass}
              value={assignRole}
              onChange={(event) =>
                onAssignRole(event.target.value as (typeof PROJECT_ROLES)[number])
              }
            >
              {PROJECT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" loading={assigning}>
              <UserPlus />
              Assign
            </Button>
          </form>
        ) : null}
        {myAssignment && myAssignment.status !== "COMPLETED" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
            <span className="mr-auto text-sm text-muted-foreground">
              Your assignment
            </span>
            {myAssignment.status === "PENDING" ? (
              <Button
                size="sm"
                variant="outline"
                loading={assignmentActions.confirm.isPending}
                onClick={() =>
                  assignmentActions.confirm.mutate(undefined, {
                    onSuccess: () => toast.success("Assignment confirmed"),
                  })
                }
              >
                Confirm mine
              </Button>
            ) : null}
            {myAssignment.status === "IN_PROGRESS" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  loading={assignmentActions.returnAssignment.isPending}
                  onClick={() =>
                    assignmentActions.returnAssignment.mutate(undefined, {
                      onSuccess: () => toast.success("Assignment returned"),
                    })
                  }
                >
                  Return mine
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={assignmentActions.complete.isPending}
                  onClick={() =>
                    assignmentActions.complete.mutate(undefined, {
                      onSuccess: () => toast.success("Assignment completed"),
                    })
                  }
                >
                  Complete mine
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
        {assignmentActions.confirm.error ||
        assignmentActions.returnAssignment.error ||
        assignmentActions.complete.error ? (
          <p className="text-sm text-danger-soft-foreground">
            {(
              assignmentActions.confirm.error ??
              assignmentActions.returnAssignment.error ??
              assignmentActions.complete.error
            )?.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProjectMeetings({
  projectId,
  canWrite,
  onCreate,
}: {
  projectId: string;
  canWrite: boolean;
  onCreate: () => void;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const meetings = useMeetings(workspaceId, { projectId });

  if (meetings.isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (meetings.isError) {
    return (
      <ErrorState
        title="Couldn't load meetings"
        description={meetings.error.message}
        action={
          <Button size="sm" variant="outline" onClick={() => void meetings.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }
  if (!meetings.data?.length) {
    return (
      <ListPanel>
        <EmptyState
          icon={Video}
          title="No project meetings"
          description="Schedule a meeting and link it to this project."
          action={
            canWrite ? (
              <Button size="sm" onClick={onCreate}>
                <Plus />
                New meeting
              </Button>
            ) : undefined
          }
        />
      </ListPanel>
    );
  }
  return (
    <section className="space-y-3 animate-fade-in">
      <SectionTitle
        description={`${meetings.data.length} linked ${meetings.data.length === 1 ? "meeting" : "meetings"}`}
        action={
          canWrite ? (
            <Button size="sm" onClick={onCreate}>
              <Plus />
              New meeting
            </Button>
          ) : null
        }
      >
        Meetings
      </SectionTitle>
      <div className="grid gap-3">
        {meetings.data.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </section>
  );
}
