import { apiRequest } from "@/lib/api-client";
import type {
  CreateTaskInput,
  Task,
  TaskListParams,
  TaskListResponse,
  UpdateTaskInput,
} from "@/features/tasks/types";

export function listTasks(params: TaskListParams = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.priority) search.set("priority", params.priority);
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.assigneeId) search.set("assigneeId", params.assigneeId);
  if (params.includeArchived) search.set("includeArchived", "true");
  if (params.mine) search.set("mine", "true");
  if (params.parentId) search.set("parentId", params.parentId);
  if (params.milestoneId) search.set("milestoneId", params.milestoneId);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const qs = search.toString();
  return apiRequest<TaskListResponse>(`/tasks${qs ? `?${qs}` : ""}`);
}

export function getTask(taskId: string) {
  return apiRequest<Task>(`/tasks/${taskId}`);
}

export function createTask(input: CreateTaskInput) {
  return apiRequest<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(taskId: string, input: UpdateTaskInput) {
  return apiRequest<Task>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function assignTask(
  taskId: string,
  input:
    | string
    | null
    | {
        assigneeId?: string | null;
        assigneeIds?: string[];
        collaboratorIds?: string[];
        watcherIds?: string[];
      },
) {
  const body =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? input
      : { assigneeId: input };
  return apiRequest<Task>(`/tasks/${taskId}/assign`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listTaskShares(taskId: string) {
  return apiRequest<NonNullable<Task["shares"]>>(`/tasks/${taskId}/shares`);
}

export function shareTask(
  taskId: string,
  input: { userId: string; permission: "VIEW" | "COMMENT" | "EDIT" },
) {
  return apiRequest(`/tasks/${taskId}/shares`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function unshareTask(taskId: string, userId: string) {
  return apiRequest<void>(`/tasks/${taskId}/shares/${userId}`, {
    method: "DELETE",
  });
}

export function updateTaskVisibility(
  taskId: string,
  visibility: NonNullable<Task["visibility"]>,
) {
  return apiRequest<Task>(`/tasks/${taskId}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visibility }),
  });
}

export function updateTaskStatus(taskId: string, status: Task["status"]) {
  return apiRequest<Task>(`/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function submitTaskWork(
  taskId: string,
  input: {
    fileIds?: string[];
    note?: string;
    deliverables?: string;
    justification?: string;
  },
) {
  return apiRequest<Task>(`/tasks/${taskId}/submissions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function reviewTaskWork(
  taskId: string,
  input: {
    status: "APPROVED" | "RETURNED";
    note?: string;
    submissionId?: string;
  },
) {
  return apiRequest<Task>(`/tasks/${taskId}/review`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function archiveTask(taskId: string) {
  return apiRequest<Task>(`/tasks/${taskId}/archive`, {
    method: "POST",
  });
}

export function deleteTask(taskId: string) {
  return apiRequest<void>(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}
