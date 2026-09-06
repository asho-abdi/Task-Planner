import { PRIORITIES, type Priority } from "@/features/projects/types";

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "COMPLETED",
  "RETURNED",
  "OVERDUE",
  "ARCHIVED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type { Priority };

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "ARCHIVED"],
  IN_PROGRESS: ["ARCHIVED"],
  IN_REVIEW: ["ARCHIVED"],
  RETURNED: ["IN_PROGRESS", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  OVERDUE: ["IN_PROGRESS", "ARCHIVED"],
  ARCHIVED: ["TODO"],
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Assigned",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "Under review",
  COMPLETED: "Completed",
  RETURNED: "Returned",
  OVERDUE: "Overdue",
  ARCHIVED: "Archived",
};

export function nextTaskStatuses(current: TaskStatus): TaskStatus[] {
  return [
    current,
    ...TASK_STATUS_TRANSITIONS[current].filter((status) => status !== current),
  ];
}

export function taskStatusLabel(status: string) {
  return TASK_STATUS_LABELS[status as TaskStatus] ?? status.replaceAll("_", " ");
}

export type TaskPerson = {
  id: string;
  name: string;
  email: string;
};

export type TaskSubmission = {
  id: string;
  submitterId: string;
  status: "SUBMITTED" | "APPROVED" | "RETURNED";
  version: number;
  note: string | null;
  reviewNote: string | null;
  deliverables: string | null;
  justification: string | null;
  createdAt: string;
  reviewedAt: string | null;
  submitter: TaskPerson;
  reviewer: TaskPerson | null;
  files: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  projectId: string | null;
  workspaceId: string;
  ownerId: string | null;
  assignedById: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  startDate: string | null;
  estimatedHours: number | null;
  parentId: string | null;
  recurrence: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  project: { id: string; name: string; status: string } | null;
  owner: TaskPerson | null;
  assignedBy: TaskPerson | null;
  assignee: TaskPerson | null;
  assignees: TaskPerson[];
  collaborators?: TaskPerson[];
  watchers?: TaskPerson[];
  visibility?: "PRIVATE" | "PROJECT" | "WORKSPACE";
  shares?: Array<{
    id: string;
    userId: string;
    permission: "VIEW" | "COMMENT" | "EDIT";
    user: TaskPerson;
  }>;
  submissions: TaskSubmission[];
  submissionProgress: {
    submitted: number;
    approved: number;
    total: number;
  };
  assigneeWork?: Array<{
    userId: string;
    name: string;
    status: "NOT_STARTED" | "SUBMITTED" | "APPROVED" | "RETURNED";
  }>;
  latestReturnComment: string | null;
  dependsOn: Array<{ id: string; title: string; status: string }>;
  blockedBy?: Array<{ id: string; title: string; status: string }>;
  blocks?: Array<{ id: string; title: string; status: string }>;
  blocked?: boolean;
  milestoneId?: string | null;
  milestone?: { id: string; title: string; dueDate: string | null; projectId: string | null } | null;
  meetingId?: string | null;
  meeting?: { id: string; title: string } | null;
};

export type TaskListResponse = {
  items: Task[];
  page: number;
  pageSize: number;
  total: number;
};

export type TaskListParams = {
  q?: string;
  status?: TaskStatus;
  priority?: Priority;
  projectId?: string;
  assigneeId?: string;
  includeArchived?: boolean;
  mine?: boolean;
  parentId?: string;
  page?: number;
  pageSize?: number;
  milestoneId?: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  projectId?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  collaboratorIds?: string[];
  watcherIds?: string[];
  visibility?: "PRIVATE" | "PROJECT" | "WORKSPACE";
  estimatedHours?: number;
  startDate?: string;
  dependsOnTaskIds?: string[];
  blocksTaskIds?: string[];
  milestoneId?: string | null;
  parentId?: string;
  recurrence?: "DAILY" | "WEEKLY" | "MONTHLY";
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
  collaboratorIds?: string[];
  watcherIds?: string[];
  visibility?: "PRIVATE" | "PROJECT" | "WORKSPACE";
  estimatedHours?: number | null;
  startDate?: string | null;
  dependsOnTaskIds?: string[];
  blocksTaskIds?: string[];
  milestoneId?: string | null;
  recurrence?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
};

export { PRIORITIES };
