"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell, Surface } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useArchiveTodo,
  useCompleteTodo,
  useTodo,
  useUpdateTodo,
} from "@/features/todos/hooks";
import {
  TodoForm,
  todoToFormValues,
  toTodoWriteInput,
} from "@/features/todos/todo-form";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function TodoDetailPage() {
  const params = useParams<{ todoId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const todo = useTodo(workspaceId, params.todoId);
  const updateTodo = useUpdateTodo(params.todoId);
  const completeTodo = useCompleteTodo();
  const archiveTodo = useArchiveTodo();

  if (todo.isLoading) {
    return (
      <PageShell className="max-w-3xl">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </PageShell>
    );
  }

  if (!todo.data) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Todo not found.</p>
      </PageShell>
    );
  }

  const item = todo.data;

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title={item.title}
        backHref="/app/todos"
        backLabel="Back to todos"
        actions={<StatusBadge value={item.status} />}
      />
      <Surface>
      <TodoForm
        key={item.updatedAt}
        initial={todoToFormValues(item)}
        submitting={updateTodo.isPending}
        submitLabel="Save"
        error={updateTodo.error?.message}
        extraActions={
          <>
            {item.status !== "COMPLETED" && item.status !== "ARCHIVED" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void completeTodo.mutateAsync(item.id)}
                disabled={completeTodo.isPending}
              >
                Complete
              </Button>
            ) : null}
            {item.status !== "ARCHIVED" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void archiveTodo.mutateAsync(item.id)}
                disabled={archiveTodo.isPending}
              >
                Archive
              </Button>
            ) : null}
          </>
        }
        onSubmit={async (values) => {
          await updateTodo.mutateAsync(toTodoWriteInput(values));
        }}
      />
      </Surface>
    </PageShell>
  );
}
