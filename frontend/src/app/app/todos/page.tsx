"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Archive,
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  Inbox,
  ListTodo,
  Plus,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, ListPanel, PageHeader, PageShell } from "@/components/page-header";
import { PriorityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useArchiveTodo,
  useCompleteTodo,
  useCreateTodo,
  useTodos,
} from "@/features/todos/hooks";
import { emptyTodoForm, toTodoWriteInput } from "@/features/todos/todo-form";
import type { Todo } from "@/features/todos/types";
import { cn, formatDateTime, localDateYmd } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

type GroupKey = "overdue" | "today" | "upcoming" | "someday" | "completed" | "archived";

const GROUPS: Array<{ key: GroupKey; title: string; icon: LucideIcon; tone: string }> = [
  { key: "overdue", title: "Overdue", icon: CircleAlert, tone: "text-danger-soft-foreground" },
  { key: "today", title: "Today", icon: Sun, tone: "text-warning-soft-foreground" },
  { key: "upcoming", title: "Upcoming", icon: CalendarDays, tone: "text-info-soft-foreground" },
  { key: "someday", title: "No due date", icon: Inbox, tone: "text-muted-foreground" },
  { key: "completed", title: "Completed", icon: CircleCheck, tone: "text-success-soft-foreground" },
  { key: "archived", title: "Archived", icon: Archive, tone: "text-muted-foreground" },
];

function dueYmd(todo: Todo) {
  return todo.dueDate ? todo.dueDate.slice(0, 10) : null;
}

function groupOf(todo: Todo, today: string): GroupKey {
  if (todo.status === "COMPLETED") return "completed";
  if (todo.status === "ARCHIVED") return "archived";
  const due = dueYmd(todo);
  if (!due) return "someday";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

function shiftYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return localDateYmd(new Date(y, m - 1, d + days));
}

function dueLabel(ymd: string, today: string) {
  if (ymd === today) return "Today";
  if (ymd === shiftYmd(today, 1)) return "Tomorrow";
  if (ymd === shiftYmd(today, -1)) return "Yesterday";
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(ymd.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
  });
}

export default function TodosPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const todos = useTodos(workspaceId);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const items = todos.data ?? [];
  const today = localDateYmd();

  const grouped = GROUPS.map((group) => ({
    ...group,
    items: items.filter((todo) => groupOf(todo, today) === group.key),
  }));
  const openCount = items.filter((todo) => todo.status === "PENDING").length;
  const doneCount = items.filter((todo) => todo.status === "COMPLETED").length;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Todos"
        icon={ListTodo}
        description="Personal items in the current workspace."
        meta={
          items.length ? (
            <span className="tabular">
              {openCount} open · {doneCount} completed
            </span>
          ) : null
        }
        actions={
          <Button variant="outline" onClick={() => setOpenCreateDialog("todo")}>
            <Plus />
            New todo
          </Button>
        }
      />

      <QuickAdd />

      {todos.isLoading ? (
        <ListPanel>
          <div role="status" aria-label="Loading todos" className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </ListPanel>
      ) : todos.isError ? (
        <ErrorState
          title="Couldn't load todos"
          description={todos.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void todos.refetch()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <ListPanel>
          <EmptyState
            icon={ListTodo}
            title="No todos yet"
            description="Keep a quiet list of personal follow-ups."
            action={
              <Button onClick={() => setOpenCreateDialog("todo")}>
                <Plus />
                New todo
              </Button>
            }
          />
        </ListPanel>
      ) : (
        grouped.map((group) => {
          if (group.items.length === 0) return null;
          const Icon = group.icon;
          return (
            <section key={group.key} className="space-y-2" aria-labelledby={`todos-${group.key}`}>
              <h2
                id={`todos-${group.key}`}
                className="flex items-center gap-2 px-1 text-sm font-semibold text-foreground"
              >
                <Icon className={cn("size-4", group.tone)} />
                {group.title}
                <span className="rounded-full bg-muted px-1.5 text-2xs font-medium tabular text-muted-foreground">
                  {group.items.length}
                </span>
              </h2>
              <ListPanel>
                <ul className="divide-y divide-border">
                  {group.items.map((todo) => (
                    <TodoRow key={todo.id} todo={todo} today={today} />
                  ))}
                </ul>
              </ListPanel>
            </section>
          );
        })
      )}
    </PageShell>
  );
}

function QuickAdd() {
  const createTodo = useCreateTodo();
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await createTodo.mutateAsync(toTodoWriteInput({ ...emptyTodoForm(), title }));
      setTitle("");
      toast.success("Todo added");
    } catch {
      // Errors are toasted globally.
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-xl border border-input bg-card py-1.5 pl-3 pr-1.5 shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-subtle-foreground">
        <Plus className="size-3" strokeWidth={2.5} />
      </span>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a todo and press Enter"
        aria-label="Quick add todo"
        className="h-8 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-subtle-foreground focus:outline-none"
      />
      <Button type="submit" size="sm" disabled={!title.trim()} loading={createTodo.isPending}>
        Add
      </Button>
    </form>
  );
}

function TodoRow({ todo, today }: { todo: Todo; today: string }) {
  const completeTodo = useCompleteTodo();
  const archiveTodo = useArchiveTodo();
  const completed = todo.status === "COMPLETED";
  const archived = todo.status === "ARCHIVED";
  const due = dueYmd(todo);
  const overdue = !completed && !archived && due !== null && due < today;

  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-accent/50 sm:px-4">
      <Tooltip content={completed ? "Completed" : archived ? "Archived" : "Mark complete"}>
        <button
          type="button"
          role="checkbox"
          aria-checked={completed}
          aria-label={completed ? `${todo.title} is completed` : `Mark ${todo.title} complete`}
          disabled={completed || archived || completeTodo.isPending}
          onClick={() => {
            void completeTodo
              .mutateAsync(todo.id)
              .then(() => toast.success("Todo completed"))
              .catch(() => undefined);
          }}
          className={cn(
            "group/check flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            completed
              ? "border-success bg-success text-success-foreground"
              : archived
                ? "border-dashed border-border-strong text-subtle-foreground"
                : "border-border-strong text-transparent hover:border-success hover:text-success enabled:cursor-pointer",
          )}
        >
          {completeTodo.isPending ? (
            <Spinner className="size-3 text-muted-foreground" />
          ) : (
            <Check className="size-3" strokeWidth={3} />
          )}
        </button>
      </Tooltip>
      <Link
        href={`/app/todos/${todo.id}`}
        className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p
          className={cn(
            "truncate text-base font-medium",
            completed || archived ? "text-muted-foreground line-through decoration-subtle-foreground" : "text-foreground",
          )}
        >
          {todo.title}
        </p>
        {todo.description ? (
          <p className="truncate text-sm text-subtle-foreground">{todo.description}</p>
        ) : null}
      </Link>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {todo.reminderAt ? (
          <Tooltip content={`Reminder ${formatDateTime(todo.reminderAt)}`}>
            <span
              tabIndex={0}
              aria-label={`Reminder ${formatDateTime(todo.reminderAt)}`}
              className="rounded-sm text-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell className="size-3.5" />
            </span>
          </Tooltip>
        ) : null}
        {due ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs tabular",
              overdue ? "font-medium text-danger-soft-foreground" : "text-muted-foreground",
            )}
          >
            <CalendarClock className="hidden size-3.5 sm:block" />
            {dueLabel(due, today)}
          </span>
        ) : null}
        <PriorityBadge value={todo.priority} className="hidden min-[420px]:inline-flex" />
        {!archived ? (
          <Tooltip content="Archive">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Archive ${todo.title}`}
              loading={archiveTodo.isPending}
              className="sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              onClick={() => {
                void archiveTodo
                  .mutateAsync(todo.id)
                  .then(() => toast.success("Todo archived"))
                  .catch(() => undefined);
              }}
            >
              <Archive />
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </li>
  );
}
