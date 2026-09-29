"use client";

import { useState, type FormEvent } from "react";
import { Field, FormActions } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRIORITIES, type Priority, type TodoWriteInput } from "@/features/todos/types";
import {
  cn,
  fromDateInputValue,
  fromDateTimeLocalValue,
  nativeSelectClass,
  nativeTextareaClass,
  toDateInputValue,
  toDateTimeLocalValue,
} from "@/lib/utils";

export type TodoFormValues = {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  reminderAt: string;
};

export function emptyTodoForm(): TodoFormValues {
  return {
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    reminderAt: "",
  };
}

export function todoToFormValues(todo: {
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  reminderAt: string | null;
}): TodoFormValues {
  return {
    title: todo.title,
    description: todo.description ?? "",
    priority: todo.priority,
    dueDate: toDateInputValue(todo.dueDate),
    reminderAt: toDateTimeLocalValue(todo.reminderAt),
  };
}

export function toTodoWriteInput(values: TodoFormValues): TodoWriteInput {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    priority: values.priority,
    dueDate: fromDateInputValue(values.dueDate),
    reminderAt: fromDateTimeLocalValue(values.reminderAt),
  };
}

function priorityLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function TodoForm({
  initial,
  submitting,
  submitLabel,
  error,
  extraActions,
  onSubmit,
}: {
  initial: TodoFormValues;
  submitting: boolean;
  submitLabel: string;
  error?: string;
  extraActions?: React.ReactNode;
  onSubmit: (values: TodoFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Title" htmlFor="todo-title">
        <Input
          id="todo-title"
          value={values.title}
          placeholder="What do you need to do?"
          onChange={(event) =>
            setValues((current) => ({ ...current, title: event.target.value }))
          }
          autoFocus
          required
        />
      </Field>
      <Field label="Description" htmlFor="todo-description">
        <textarea
          id="todo-description"
          className={cn(nativeTextareaClass, "min-h-20")}
          placeholder="Add notes or context (optional)"
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" htmlFor="todo-priority">
          <select
            id="todo-priority"
            className={nativeSelectClass}
            value={values.priority}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                priority: event.target.value as Priority,
              }))
            }
          >
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {priorityLabel(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date" htmlFor="todo-due">
          <Input
            id="todo-due"
            type="date"
            value={values.dueDate}
            onChange={(event) =>
              setValues((current) => ({ ...current, dueDate: event.target.value }))
            }
          />
        </Field>
      </div>
      <div className="space-y-1.5">
        <Field label="Reminder" htmlFor="todo-reminder">
          <Input
            id="todo-reminder"
            type="datetime-local"
            value={values.reminderAt}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                reminderAt: event.target.value,
              }))
            }
          />
        </Field>
        <p className="text-xs text-subtle-foreground">
          You&apos;ll get a notification at this time.
        </p>
      </div>
      {error ? <p className="text-sm text-danger-soft-foreground">{error}</p> : null}
      <FormActions>
        {extraActions}
        <Button
          type="submit"
          disabled={!values.title.trim()}
          loading={submitting}
        >
          {submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
