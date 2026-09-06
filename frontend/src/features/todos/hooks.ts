"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as todosApi from "@/features/todos/api";
import type { TodoWriteInput } from "@/features/todos/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export const todoKeys = {
  all: (workspaceId: string) => ["todos", workspaceId] as const,
};

function useInvalidateTodos() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return () => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({ queryKey: todoKeys.all(workspaceId) });
  };
}

export function useTodos(
  workspaceId: string | null,
  includeArchived = false,
  enabled = true,
) {
  return useQuery({
    queryKey: [...todoKeys.all(workspaceId ?? "none"), includeArchived],
    queryFn: () => todosApi.listTodos(includeArchived),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 60_000,
  });
}

export function useTodo(workspaceId: string | null, todoId: string) {
  return useQuery({
    queryKey: [...todoKeys.all(workspaceId ?? "none"), "detail", todoId],
    queryFn: () => todosApi.getTodo(todoId),
    enabled: Boolean(workspaceId) && Boolean(todoId),
    staleTime: 60_000,
  });
}

export function useCreateTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: todosApi.createTodo,
    onSuccess: invalidate,
  });
}

export function useUpdateTodo(todoId: string) {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: (input: TodoWriteInput) => todosApi.updateTodo(todoId, input),
    onSuccess: invalidate,
  });
}

export function useCompleteTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: todosApi.completeTodo,
    onSuccess: invalidate,
  });
}

export function useArchiveTodo() {
  const invalidate = useInvalidateTodos();
  return useMutation({
    mutationFn: todosApi.archiveTodo,
    onSuccess: invalidate,
  });
}
