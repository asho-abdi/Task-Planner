import { apiRequest } from "@/lib/api-client";
import type { Todo, TodoWriteInput } from "@/features/todos/types";

export function listTodos(includeArchived = false) {
  const search = includeArchived ? "?includeArchived=true" : "";
  return apiRequest<Todo[]>(`/todos${search}`);
}

export function getTodo(todoId: string) {
  return apiRequest<Todo>(`/todos/${todoId}`);
}

export function createTodo(input: TodoWriteInput) {
  return apiRequest<Todo>("/todos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTodo(todoId: string, input: TodoWriteInput) {
  return apiRequest<Todo>(`/todos/${todoId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function completeTodo(todoId: string) {
  return apiRequest<Todo>(`/todos/${todoId}/complete`, { method: "POST" });
}

export function archiveTodo(todoId: string) {
  return apiRequest<Todo>(`/todos/${todoId}/archive`, { method: "POST" });
}
