import { apiRequest, authorizedFetch } from "@/lib/api-client";
import type {
  InboxNotification,
  NotificationList,
  NotificationPrefs,
  PlanDayResult,
  PlatformUser,
  ProjectAssignment,
  TaskComment,
  Team,
  TimeEntry,
  WorkspaceFile,
  WorkspacePage,
  FileAttach,
} from "@/features/collaboration/types";

export function listNotifications() {
  return apiRequest<NotificationList>("/notifications");
}

export function markNotificationRead(id: string) {
  return apiRequest<NotificationList>(`/notifications/${id}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead() {
  return apiRequest<NotificationList>("/notifications/read-all", {
    method: "POST",
  });
}

export function updateNotificationPrefs(input: Partial<NotificationPrefs>) {
  return apiRequest<NotificationPrefs>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listTeams() {
  return apiRequest<Team[]>("/teams");
}

export function createTeam(input: {
  name: string;
  description?: string;
  icon?: string;
}) {
  return apiRequest<Team>("/teams", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addTeamMember(
  teamId: string,
  userId: string,
  role?: "ADMIN" | "MEMBER",
) {
  return apiRequest<Team>(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  });
}

export function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
) {
  return apiRequest<Team>(`/teams/${teamId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeTeamMember(teamId: string, userId: string) {
  return apiRequest<void>(`/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function listFiles(query: FileAttach = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return apiRequest<WorkspaceFile[]>(`/files${qs ? `?${qs}` : ""}`);
}

export function uploadFile(file: File, attach: FileAttach = {}) {
  const body = new FormData();
  body.append("file", file);
  for (const [key, value] of Object.entries(attach)) {
    if (value) body.append(key, value);
  }
  return apiRequest<WorkspaceFile>("/files", { method: "POST", body });
}

async function fetchFileBlob(fileId: string, mode: "download" | "preview") {
  const response = await authorizedFetch(`/files/${fileId}/${mode}`);
  if (!response.ok) {
    throw new Error(
      mode === "preview" ? "Unable to preview file" : "Unable to download file",
    );
  }
  return response.blob();
}

export async function previewFileUrl(fileId: string) {
  const blob = await fetchFileBlob(fileId, "preview");
  return URL.createObjectURL(blob);
}

export async function downloadFile(fileId: string, name: string) {
  const blob = await fetchFileBlob(fileId, "download");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function renameFile(fileId: string, originalName: string) {
  return apiRequest<WorkspaceFile>(`/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ originalName }),
  });
}

export function moveFile(fileId: string, attach: FileAttach) {
  return apiRequest<WorkspaceFile>(`/files/${fileId}/move`, {
    method: "POST",
    body: JSON.stringify(attach),
  });
}

export function deleteFile(fileId: string) {
  return apiRequest<void>(`/files/${fileId}`, { method: "DELETE" });
}

export function listPages() {
  return apiRequest<WorkspacePage[]>("/pages");
}

export function getPage(pageId: string) {
  return apiRequest<WorkspacePage>(`/pages/${pageId}`);
}

export function createPage(input: { title: string; body?: string }) {
  return apiRequest<WorkspacePage>("/pages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePage(
  pageId: string,
  input: { title?: string; body?: string },
) {
  return apiRequest<WorkspacePage>(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePage(pageId: string) {
  return apiRequest<void>(`/pages/${pageId}`, { method: "DELETE" });
}

export function listComments(taskId: string) {
  return apiRequest<TaskComment[]>(`/tasks/${taskId}/comments`);
}

export function addComment(
  taskId: string,
  body: string,
  parentId?: string,
) {
  return apiRequest<TaskComment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, parentId }),
  });
}

export function reactToComment(taskId: string, commentId: string, emoji: string) {
  return apiRequest<TaskComment>(
    `/tasks/${taskId}/comments/${commentId}/reactions`,
    { method: "POST", body: JSON.stringify({ emoji }) },
  );
}

export function entityHref(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): string | null {
  if (entityType === "file") return "/app/files";
  if (entityType === "team") return "/app/teams";
  if (entityType === "invitation") return "/app/settings#members";
  if (!entityId) return null;
  if (entityType === "task") return `/app/tasks/${entityId}`;
  if (entityType === "project") return `/app/projects/${entityId}`;
  if (entityType === "meeting") return `/app/meetings/${entityId}`;
  if (entityType === "conversation") return `/app/chat?c=${entityId}`;
  if (entityType === "goal") return `/app/goals/${entityId}`;
  if (entityType === "todo") return `/app/todos/${entityId}`;
  if (entityType === "page") return `/app/pages/${entityId}`;
  return null;
}

export function notificationHref(item: InboxNotification) {
  return entityHref(item.entityType, item.entityId) ?? "/app/notifications";
}

export function listSubtasks(taskId: string) {
  return apiRequest<unknown[]>(`/tasks/${taskId}/subtasks`);
}

export function submitTask(
  taskId: string,
  input: {
    fileIds?: string[];
    note?: string;
    deliverables?: string;
    justification?: string;
  },
) {
  return apiRequest(`/tasks/${taskId}/submissions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function reviewTask(
  taskId: string,
  status: "APPROVED" | "RETURNED",
  note?: string,
  submissionId?: string,
) {
  return apiRequest(`/tasks/${taskId}/review`, {
    method: "POST",
    body: JSON.stringify({ status, note, submissionId }),
  });
}

export function startTimer(taskId: string) {
  return apiRequest<TimeEntry>(`/tasks/${taskId}/time/start`, {
    method: "POST",
  });
}

export function stopTimer(taskId: string) {
  return apiRequest<TimeEntry>(`/tasks/${taskId}/time/stop`, {
    method: "POST",
  });
}

export function applySchedule(
  items: Array<{
    taskId: string;
    scheduledStart: string;
    scheduledEnd: string;
  }>,
) {
  return apiRequest("/tasks/schedule", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function assignProject(
  projectId: string,
  userId: string,
  role?: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER",
) {
  return apiRequest<ProjectAssignment>(`/projects/${projectId}/assign`, {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  });
}

export function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: "OWNER" | "MANAGER" | "MEMBER" | "VIEWER",
) {
  return apiRequest<ProjectAssignment[]>(
    `/projects/${projectId}/members/${userId}`,
    { method: "PATCH", body: JSON.stringify({ role }) },
  );
}

export function removeProjectMember(projectId: string, userId: string) {
  return apiRequest<void>(`/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function listProjectAssignments(projectId: string) {
  return apiRequest<ProjectAssignment[]>(
    `/projects/${projectId}/assignments`,
  );
}

export function confirmProjectAssignment(projectId: string) {
  return apiRequest<ProjectAssignment>(
    `/projects/${projectId}/assignments/confirm`,
    { method: "POST" },
  );
}

export function returnProjectAssignment(projectId: string) {
  return apiRequest<ProjectAssignment>(
    `/projects/${projectId}/assignments/return`,
    { method: "POST" },
  );
}

export function completeProjectAssignment(projectId: string) {
  return apiRequest<ProjectAssignment>(
    `/projects/${projectId}/assignments/complete`,
    { method: "POST" },
  );
}

export function planDay(date?: string) {
  return apiRequest<PlanDayResult>("/ai/plan-day", {
    method: "POST",
    body: JSON.stringify({ date }),
  });
}

export function listPlatformUsers() {
  return apiRequest<PlatformUser[]>("/users");
}

export type WorkspaceAutomation = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  createdAt: string;
};

export function listAutomations() {
  return apiRequest<WorkspaceAutomation[]>("/automations");
}

export function createAutomation(input: {
  name: string;
  trigger: string;
  action: string;
}) {
  return apiRequest<WorkspaceAutomation>("/automations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAutomation(
  automationId: string,
  input: { name?: string; enabled?: boolean },
) {
  return apiRequest<WorkspaceAutomation>(`/automations/${automationId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAutomation(automationId: string) {
  return apiRequest<void>(`/automations/${automationId}`, { method: "DELETE" });
}

export type { InboxNotification };
