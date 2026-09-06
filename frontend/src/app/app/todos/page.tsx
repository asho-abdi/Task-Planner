"use client";

import Link from "next/link";
import { EmptyState, PageHeader, PageShell, SectionTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTodos } from "@/features/todos/hooks";
import type { Todo, TodoStatus } from "@/features/todos/types";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const GROUPS: Array<{ status: TodoStatus; title: string }> = [
  { status: "PENDING", title: "To do" },
  { status: "COMPLETED", title: "Completed" },
  { status: "ARCHIVED", title: "Archived" },
];

export default function TodosPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const todos = useTodos(workspaceId);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const items = todos.data ?? [];

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Todos"
        description="Personal items in the current workspace."
        actions={
          <Button onClick={() => setOpenCreateDialog("todo")}>New todo</Button>
        }
      />
      {todos.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : todos.isError ? (
        <p className="text-sm text-destructive">{todos.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No todos yet"
          description="Keep a quiet list of personal follow-ups."
          action={
            <Button onClick={() => setOpenCreateDialog("todo")}>New todo</Button>
          }
        />
      ) : (
        GROUPS.map((group) => {
          const groupItems = items.filter((todo) => todo.status === group.status);
          if (groupItems.length === 0) return null;
          return (
            <section key={group.status} className="space-y-3">
              <SectionTitle>
                {group.title}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {groupItems.length}
                </span>
              </SectionTitle>
              <div className="space-y-2">
                {groupItems.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </PageShell>
  );
}

function TodoRow({ todo }: { todo: Todo }) {
  return (
    <Link
      href={`/app/todos/${todo.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-soft)] transition-colors hover:bg-secondary"
    >
      <div className="min-w-0">
        <p
          className={`truncate font-medium ${todo.status === "COMPLETED" ? "text-muted-foreground line-through" : ""}`}
        >
          {todo.title}
        </p>
        <p className="text-sm text-muted-foreground">
          {todo.dueDate ? todo.dueDate.slice(0, 10) : "No due date"}
        </p>
      </div>
      <StatusBadge value={todo.priority} />
    </Link>
  );
}
