"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, FormActions } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import type { useProjects } from "@/features/projects/hooks";
import type { GoalWriteInput } from "@/features/goals/types";
import {
  cn,
  fromDateInputValue,
  nativeTextareaClass,
  toDateInputValue,
} from "@/lib/utils";

export type MilestoneDraft = {
  key: string;
  title: string;
  dueDate: string;
  progress: number;
};

export type GoalFormValues = {
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  projectIds: string[];
  milestones: MilestoneDraft[];
};

export function emptyGoalForm(): GoalFormValues {
  return {
    title: "",
    description: "",
    targetDate: "",
    progress: 0,
    projectIds: [],
    milestones: [],
  };
}

export function goalToFormValues(goal: {
  title: string;
  description: string | null;
  targetDate: string | null;
  progress: number;
  projects: { id: string }[];
  milestones: { title: string; dueDate: string | null; progress: number }[];
}): GoalFormValues {
  return {
    title: goal.title,
    description: goal.description ?? "",
    targetDate: toDateInputValue(goal.targetDate),
    progress: goal.progress,
    projectIds: goal.projects.map((item) => item.id),
    milestones: goal.milestones.map((item, index) => ({
      key: `${index}-${item.title}`,
      title: item.title,
      dueDate: toDateInputValue(item.dueDate),
      progress: item.progress,
    })),
  };
}

export function toGoalWriteInput(values: GoalFormValues): GoalWriteInput {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    targetDate: fromDateInputValue(values.targetDate),
    progress: values.progress,
    projectIds: values.projectIds,
    milestones: values.milestones
      .filter((item) => item.title.trim())
      .map((item) => ({
        title: item.title.trim(),
        dueDate: fromDateInputValue(item.dueDate),
        progress: item.progress,
      })),
  };
}

function newDraftKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function GoalForm({
  initial,
  projects,
  submitting,
  submitLabel,
  error,
  extraActions,
  autoFocusTitle = true,
  onSubmit,
}: {
  initial: GoalFormValues;
  projects: ReturnType<typeof useProjects>;
  submitting: boolean;
  submitLabel: string;
  error?: string;
  extraActions?: React.ReactNode;
  /** Focus the title input on mount (dialogs). Defaults to true. */
  autoFocusTitle?: boolean;
  onSubmit: (values: GoalFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);

  function toggleProject(projectId: string) {
    setValues((current) => ({
      ...current,
      projectIds: current.projectIds.includes(projectId)
        ? current.projectIds.filter((id) => id !== projectId)
        : [...current.projectIds, projectId],
    }));
  }

  function addMilestone() {
    setValues((current) => ({
      ...current,
      milestones: [
        ...current.milestones,
        { key: newDraftKey(), title: "", dueDate: "", progress: 0 },
      ],
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Title" htmlFor="goal-title">
        <Input
          id="goal-title"
          value={values.title}
          placeholder="Launch the new onboarding flow"
          onChange={(event) =>
            setValues((current) => ({ ...current, title: event.target.value }))
          }
          autoFocus={autoFocusTitle}
          required
        />
      </Field>
      <Field label="Description" htmlFor="goal-description">
        <textarea
          id="goal-description"
          className={nativeTextareaClass}
          value={values.description}
          placeholder="Optional"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target date" htmlFor="goal-target">
          <Input
            id="goal-target"
            type="date"
            value={values.targetDate}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                targetDate: event.target.value,
              }))
            }
          />
        </Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="goal-progress">Progress</Label>
            <span className="text-sm font-medium leading-none text-foreground tabular">
              {values.progress}%
            </span>
          </div>
          <div className="flex h-9 items-center">
            <input
              id="goal-progress"
              type="range"
              min={0}
              max={100}
              value={values.progress}
              className="w-full cursor-pointer accent-primary"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  progress: Number(event.target.value),
                }))
              }
            />
          </div>
        </div>
      </div>
      <Field label="Linked projects" loading={projects.isLoading}>
        <div className="max-h-44 overflow-auto rounded-lg border border-border bg-background p-1">
          {(projects.data ?? []).map((project) => {
            const checked = values.projectIds.includes(project.id);
            return (
              <label
                key={project.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                  checked={checked}
                  onChange={() => toggleProject(project.id)}
                />
                <span className="truncate">{project.name}</span>
              </label>
            );
          })}
          {!projects.isLoading && (projects.data ?? []).length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No projects yet.
            </p>
          ) : null}
        </div>
        {values.projectIds.length ? (
          <p className="text-xs text-muted-foreground tabular">
            {values.projectIds.length} selected
          </p>
        ) : null}
      </Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Milestones</p>
            <p className="text-xs text-muted-foreground">
              Title, due date and progress (0–100).
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addMilestone}>
            <Plus />
            Add milestone
          </Button>
        </div>
        {values.milestones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            No milestones yet.
          </p>
        ) : null}
        {values.milestones.map((milestone, index) => (
          <div
            key={milestone.key}
            className="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-2 rounded-lg border border-border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_9rem_5rem_auto]"
          >
            <Input
              placeholder="Milestone"
              aria-label={`Milestone ${index + 1} title`}
              className="col-span-3 sm:col-span-1"
              value={milestone.title}
              onChange={(event) =>
                setValues((current) => {
                  const milestones = [...current.milestones];
                  milestones[index] = {
                    ...milestones[index],
                    title: event.target.value,
                  };
                  return { ...current, milestones };
                })
              }
            />
            <Input
              type="date"
              aria-label={`Milestone ${index + 1} due date`}
              value={milestone.dueDate}
              onChange={(event) =>
                setValues((current) => {
                  const milestones = [...current.milestones];
                  milestones[index] = {
                    ...milestones[index],
                    dueDate: event.target.value,
                  };
                  return { ...current, milestones };
                })
              }
            />
            <Input
              type="number"
              min={0}
              max={100}
              aria-label={`Milestone ${index + 1} progress`}
              value={milestone.progress}
              onChange={(event) =>
                setValues((current) => {
                  const milestones = [...current.milestones];
                  milestones[index] = {
                    ...milestones[index],
                    progress: Number(event.target.value),
                  };
                  return { ...current, milestones };
                })
              }
            />
            <Tooltip content="Remove milestone">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove milestone ${index + 1}`}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    milestones: current.milestones.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2 />
              </Button>
            </Tooltip>
          </div>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-danger-soft-foreground">{error}</p>
      ) : null}
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
