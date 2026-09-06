"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as tasksApi from "@/features/tasks/api";
import { insightKeys } from "@/features/insights/hooks";
import { projectKeys } from "@/features/projects/hooks";
import type { Task, TaskListParams, UpdateTaskInput } from "@/features/tasks/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export const taskKeys = {
  all: (workspaceId: string) => ["tasks", workspaceId] as const,
  list: (workspaceId: string, params: TaskListParams) =>
    [...taskKeys.all(workspaceId), "list", params] as const,
  detail: (workspaceId: string, taskId: string) =>
    [...taskKeys.all(workspaceId), "detail", taskId] as const,
};

export function useTasks(
  workspaceId: string | null,
  params: TaskListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: taskKeys.list(workspaceId ?? "none", params),
    queryFn: () => tasksApi.listTasks(params),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 60_000,
  });
}

export function useTask(workspaceId: string | null, taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(workspaceId ?? "none", taskId),
    queryFn: () => tasksApi.getTask(taskId),
    enabled: Boolean(workspaceId) && Boolean(taskId),
    staleTime: 60_000,
  });
}

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return () => {
    if (!workspaceId) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: taskKeys.all(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: projectKeys.all(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: insightKeys.all(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: ["subtasks", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
  };
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: invalidate,
  });
}

export function useUpdateTask(taskId: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => tasksApi.updateTask(taskId, input),
    onSuccess: invalidate,
  });
}

export function useAssignTask(taskId: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (
      input:
        | string
        | null
        | {
            assigneeId?: string | null;
            assigneeIds?: string[];
            collaboratorIds?: string[];
            watcherIds?: string[];
          },
    ) => tasksApi.assignTask(taskId, input),
    onSuccess: invalidate,
  });
}

export function useShareTask(taskId: string) {
  const invalidate = useInvalidateTasks();
  return {
    share: useMutation({
      mutationFn: (input: {
        userId: string;
        permission: "VIEW" | "COMMENT" | "EDIT";
      }) => tasksApi.shareTask(taskId, input),
      onSuccess: invalidate,
    }),
    unshare: useMutation({
      mutationFn: (userId: string) => tasksApi.unshareTask(taskId, userId),
      onSuccess: invalidate,
    }),
    setVisibility: useMutation({
      mutationFn: (visibility: NonNullable<Task["visibility"]>) =>
        tasksApi.updateTaskVisibility(taskId, visibility),
      onSuccess: invalidate,
    }),
  };
}

export function useMutateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) => tasksApi.updateTask(taskId, input),
    onSuccess: invalidate,
  });
}

export function useStartTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (taskId: string) =>
      tasksApi.updateTaskStatus(taskId, "IN_PROGRESS"),
    onSuccess: invalidate,
  });
}

export function useArchiveTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: tasksApi.archiveTask,
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: tasksApi.deleteTask,
    onSuccess: invalidate,
  });
}
