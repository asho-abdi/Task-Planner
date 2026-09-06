import { PRIORITIES, type Priority } from "@/features/projects/types";

export const TODO_STATUSES = ["PENDING", "COMPLETED", "ARCHIVED"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];
export type { Priority };

export type Todo = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TodoStatus;
  dueDate: string | null;
  reminderAt: string | null;
  completedAt: string | null;
  workspaceId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type TodoWriteInput = {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  reminderAt?: string;
};

export { PRIORITIES };
