"use client";

import { useState, type FormEvent } from "react";
import { Field, FormActions } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRIORITIES, type Priority, type TodoWriteInput } from "@/features/todos/types";
import {
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field label="Title" htmlFor="todo-title">
        <Input
          id="todo-title"
          value={values.title}
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
          className={nativeTextareaClass}
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </Field>
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
              {item}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <FormActions>
        {extraActions}
        <Button type="submit" disabled={!values.title.trim() || submitting}>
          {submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
