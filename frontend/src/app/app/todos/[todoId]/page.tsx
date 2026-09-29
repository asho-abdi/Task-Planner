"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, Bell, CalendarDays, CircleCheck, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, PageShell, SectionTitle, Surface } from "@/components/page-header";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
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
import { cn, formatDateTime, formatRelativeTime, localDateYmd } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

function formatDue(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TodoDetailPage() {
  const params = useParams<{ todoId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const todo = useTodo(workspaceId, params.todoId);
  const updateTodo = useUpdateTodo(params.todoId);
  const completeTodo = useCompleteTodo();
  const archiveTodo = useArchiveTodo();

  if (todo.isLoading) {
    return (
      <PageShell width="narrow">
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-8 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className={cn("w-full", index === 1 ? "h-20" : "h-9")} />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (!todo.data) {
    return (
      <PageShell width="narrow">
        <PageHeader
          title="Todo"
          breadcrumbs={[{ label: "Todos", href: "/app/todos" }, { label: "Not found" }]}
        />
        {todo.isError ? (
          <ErrorState
            title="Couldn't load this todo"
            description={todo.error.message}
            action={
              <Button size="sm" variant="outline" onClick={() => void todo.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <Surface>
          <EmptyState
            icon={ListTodo}
            title="Todo not found."
            description="It may have been removed from this workspace."
            action={
              <Button asChild variant="outline">
                <Link href="/app/todos">Back to todos</Link>
              </Button>
            }
          />
        </Surface>
      </PageShell>
    );
  }

  const item = todo.data;
  const due = item.dueDate ? item.dueDate.slice(0, 10) : null;
  const overdue = item.status === "PENDING" && due !== null && due < localDateYmd();

  return (
    <PageShell width="narrow">
      <PageHeader
        title={item.title}
        breadcrumbs={[{ label: "Todos", href: "/app/todos" }, { label: item.title }]}
        meta={
          <>
            <StatusBadge value={item.status} />
            <PriorityBadge value={item.priority} />
            {due ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue && "font-medium text-danger-soft-foreground",
                )}
              >
                <CalendarDays className="size-3.5" />
                {overdue ? "Overdue · " : "Due "}
                {formatDue(due)}
              </span>
            ) : null}
            {item.reminderAt ? (
              <span className="inline-flex items-center gap-1">
                <Bell className="size-3.5" />
                {formatDateTime(item.reminderAt)}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            {item.status !== "COMPLETED" && item.status !== "ARCHIVED" ? (
              <Button
                type="button"
                variant="outline"
                loading={completeTodo.isPending}
                onClick={() => {
                  void completeTodo
                    .mutateAsync(item.id)
                    .then(() => toast.success("Todo completed"))
                    .catch(() => undefined);
                }}
              >
                {completeTodo.isPending ? null : <CircleCheck />}
                Complete
              </Button>
            ) : null}
            {item.status !== "ARCHIVED" ? (
              <Button
                type="button"
                variant="ghost"
                loading={archiveTodo.isPending}
                onClick={() => {
                  void archiveTodo
                    .mutateAsync(item.id)
                    .then(() => toast.success("Todo archived"))
                    .catch(() => undefined);
                }}
              >
                {archiveTodo.isPending ? null : <Archive />}
                Archive
              </Button>
            ) : null}
          </>
        }
      />
      <Surface className="space-y-5">
        <SectionTitle
          description={`Created ${formatRelativeTime(item.createdAt)} · updated ${formatRelativeTime(item.updatedAt)}`}
        >
          Details
        </SectionTitle>
        <TodoForm
          key={item.updatedAt}
          initial={todoToFormValues(item)}
          submitting={updateTodo.isPending}
          submitLabel="Save changes"
          error={updateTodo.error?.message}
          onSubmit={async (values) => {
            await updateTodo.mutateAsync(toTodoWriteInput(values));
            toast.success("Todo updated");
          }}
        />
      </Surface>
    </PageShell>
  );
}
