"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageShell, Surface } from "@/components/page-header";
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
  ProjectTimelinePanel,
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
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project.data) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>;
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
  }

  async function handleArchive() {
    await archiveProject.mutateAsync(projectId);
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
    router.push("/app/projects");
  }

  const taskItems = tasks.data?.items ?? [];

  return (
    <PageShell>
      <ProjectHeader
        project={project}
        actions={
          <>
            <Button variant="outline" onClick={() => setPlanOpen(true)}>
              Plan
            </Button>
            {canWrite ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => void saveTemplate.mutateAsync(undefined)}
                  disabled={saveTemplate.isPending}
                >
                  {saveTemplate.isPending ? "Saving…" : "Save as Template"}
                </Button>
                <Button onClick={() => openTaskCreate(projectId)}>New task</Button>
              </>
            ) : null}
          </>
        }
      />
      <ProjectTabs value={tab} onChange={setTab} />

      {tab === "overview" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Updates stay inside this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={save}>
                <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="icon">Icon</Label>
                    <Input
                      id="icon"
                      value={icon}
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
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex min-h-9 items-center gap-2">
                      <StatusBadge value={project.status} />
                      {canManage && project.status !== "ARCHIVED" ? (
                        project.status === "ON_HOLD" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void updateProject.mutateAsync({ status: "ACTIVE" })
                            }
                          >
                            Resume
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void updateProject.mutateAsync({ status: "ON_HOLD" })
                            }
                          >
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
                          {item}
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
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={updateProject.isPending}>
                      Save
                    </Button>
                    {project.status !== "ARCHIVED" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleArchive()}
                        disabled={archiveProject.isPending}
                      >
                        Archive
                      </Button>
                    ) : canDelete ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleDelete()}
                        disabled={deleteProject.isPending}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {updateProject.error ? (
                  <p className="text-sm text-destructive">
                    {updateProject.error.message}
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>
          <ProjectMembersCard
            assignments={assignments.data ?? []}
            members={members.data ?? []}
            canManage={canManage}
            assignUserId={assignUserId}
            assignRole={assignRole}
            onAssignUserId={setAssignUserId}
            onAssignRole={setAssignRole}
            onAssign={() => {
              if (assignUserId) {
                void assignProject.mutateAsync({
                  userId: assignUserId,
                  role: assignRole,
                });
              }
            }}
            onRole={(userId, role) =>
              void updateMemberRole.mutateAsync({ userId, role })
            }
            onRemove={(userId) => void removeMember.mutateAsync(userId)}
            myAssignment={myAssignment}
            assignmentActions={assignmentActions}
          />
        </div>
      ) : null}

      {tab === "tasks" ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                Add as many tasks as you need. Each task can go to different
                people, and one task can have several assignees.
              </CardDescription>
            </div>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                onClick={() => openTaskCreate(projectId)}
              >
                Add task
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={tasks}
              canWrite={canWrite}
              onAdd={() => openTaskCreate(projectId)}
            />
          </CardContent>
        </Card>
      ) : null}

      {tab === "board" ? <ProjectBoard tasks={taskItems} /> : null}

      {tab === "timeline" ? <ProjectTimelinePanel projectId={projectId} /> : null}

      {tab === "milestones" ? (
        <ProjectMilestonesPanel projectId={projectId} canWrite={canWrite} />
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
        <ProjectChat projectId={project.id} canWrite={Boolean(canWrite)} />
      ) : null}

      {tab === "calendar" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Calendar</h2>
            <p className="text-sm text-muted-foreground">
              Meetings, deadlines, and milestones for this project.
            </p>
          </div>
          <TeamCalendar
            workspaceId={project.workspaceId}
            projectId={projectId}
          />
        </div>
      ) : null}

      {tab === "notes" ? (
        <ProjectNotesPanel
          projectId={projectId}
          projectName={project.name}
          canWrite={canWrite}
        />
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
    return <Skeleton className="h-16 w-full" />;
  }
  if ((tasks.data?.items ?? []).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the first task and choose who should do it.
        </p>
        {canWrite ? (
          <Button className="mt-4" type="button" onClick={onAdd}>
            Add task
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {(tasks.data?.items ?? []).map((task) => {
        const assigneeNames = (task.assignees ?? []).length
          ? (task.assignees ?? []).map((person) => person.name).join(", ")
          : (task.assignee?.name ?? "Unassigned");
        return (
          <Link
            key={task.id}
            href={`/app/tasks/${task.id}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-3 py-2.5 text-sm hover:bg-secondary"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{task.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {assigneeNames}
              </span>
            </span>
            <StatusBadge value={task.status} />
          </Link>
        );
      })}
    </div>
  );
}

function ProjectBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {BOARD_COLUMNS.map((status) => (
        <Surface key={status} className="min-h-48 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {status.replaceAll("_", " ")}
          </p>
          {tasks
            .filter((task) => task.status === status)
            .map((task) => (
              <Link
                key={task.id}
                href={`/app/tasks/${task.id}`}
                className="block rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-primary/40"
              >
                <span className="block truncate font-medium">{task.title}</span>
                <span className="mt-1 block">
                  <StatusBadge value={task.priority} />
                </span>
              </Link>
            ))}
        </Surface>
      ))}
    </div>
  );
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
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Files</CardTitle>
          <CardDescription>Files attached to this project.</CardDescription>
        </div>
        {canWrite ? (
          <label className="inline-flex">
            <input
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload.mutateAsync({ file, attach: { projectId } });
                event.target.value = "";
              }}
            />
            <Button asChild size="sm">
              <span>{upload.isPending ? "Uploading…" : "Upload"}</span>
            </Button>
          </label>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {upload.error ? (
          <p className="text-sm text-destructive">{upload.error.message}</p>
        ) : null}
        {files.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (files.data ?? []).length === 0 ? (
          <EmptyState
            title="No files yet"
            description="Upload a file to keep it with this project."
          />
        ) : (
          (files.data ?? []).map((file) => (
            <button
              key={file.id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl bg-secondary/70 px-3 py-2 text-left text-sm"
              onClick={() => void downloadFile(file.id, file.originalName)}
            >
              <span className="truncate">{file.originalName}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(file.sizeBytes / 1024)} KB
              </span>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ProjectMembersCard({
  assignments,
  members,
  canManage,
  assignUserId,
  assignRole,
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
      <CardHeader>
        <CardTitle>Project members</CardTitle>
        <CardDescription>
          Owner has full control. Manager can manage the project. Member can
          create and update tasks. Viewer is read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              {item.user.name} · {item.status}
            </span>
            {canManage ? (
              <span className="flex items-center gap-2">
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
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
                      {role[0]}
                      {role.slice(1).toLowerCase()}
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
              <StatusBadge value={item.role ?? "MEMBER"} />
            )}
          </div>
        ))}
        {canManage ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              onAssign();
            }}
          >
            <select
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
              className={nativeSelectClass}
              value={assignRole}
              onChange={(event) =>
                onAssignRole(event.target.value as (typeof PROJECT_ROLES)[number])
              }
            >
              {PROJECT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role[0]}
                  {role.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Assign
            </Button>
          </form>
        ) : null}
        {myAssignment && myAssignment.status !== "COMPLETED" ? (
          <div className="flex flex-wrap gap-2">
            {myAssignment.status === "PENDING" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={assignmentActions.confirm.isPending}
                onClick={() => assignmentActions.confirm.mutate()}
              >
                Confirm mine
              </Button>
            ) : null}
            {myAssignment.status === "IN_PROGRESS" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={assignmentActions.returnAssignment.isPending}
                  onClick={() => assignmentActions.returnAssignment.mutate()}
                >
                  Return mine
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={assignmentActions.complete.isPending}
                  onClick={() => assignmentActions.complete.mutate()}
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
          <p className="text-sm text-destructive">
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
    return <Skeleton className="h-32 w-full" />;
  }
  if (meetings.isError) {
    return <p className="text-sm text-destructive">{meetings.error.message}</p>;
  }
  if (!meetings.data?.length) {
    return (
      <EmptyState
        title="No project meetings"
        description="Schedule a meeting and link it to this project."
        action={
          canWrite ? (
            <Button onClick={onCreate}>New meeting</Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {canWrite ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={onCreate}>
            New meeting
          </Button>
        </div>
      ) : null}
      <div className="grid gap-3">
        {meetings.data.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </div>
  );
}
