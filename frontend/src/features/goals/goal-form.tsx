"use client";

import { useState, type FormEvent } from "react";
import { Field, FormActions } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useProjects } from "@/features/projects/hooks";
import type { GoalWriteInput } from "@/features/goals/types";
import {
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
  onSubmit,
}: {
  initial: GoalFormValues;
  projects: ReturnType<typeof useProjects>;
  submitting: boolean;
  submitLabel: string;
  error?: string;
  extraActions?: React.ReactNode;
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field label="Title" htmlFor="goal-title">
        <Input
          id="goal-title"
          value={values.title}
          onChange={(event) =>
            setValues((current) => ({ ...current, title: event.target.value }))
          }
          autoFocus
          required
        />
      </Field>
      <Field label="Description" htmlFor="goal-description">
        <textarea
          id="goal-description"
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
      <div className="grid gap-3 sm:grid-cols-2">
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
        <Field label={`Progress (${values.progress}%)`} htmlFor="goal-progress">
          <Input
            id="goal-progress"
            type="range"
            min={0}
            max={100}
            value={values.progress}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                progress: Number(event.target.value),
              }))
            }
          />
        </Field>
      </div>
      <Field label="Linked projects" loading={projects.isLoading}>
        <div className="max-h-40 space-y-2 overflow-auto rounded-xl border border-border p-3">
          {(projects.data ?? []).map((project) => (
            <label key={project.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.projectIds.includes(project.id)}
                onChange={() => toggleProject(project.id)}
              />
              {project.name}
            </label>
          ))}
          {!projects.isLoading && (projects.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : null}
        </div>
      </Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Milestones</p>
          <Button type="button" variant="outline" size="sm" onClick={addMilestone}>
            Add milestone
          </Button>
        </div>
        {values.milestones.map((milestone, index) => (
          <div
            key={milestone.key}
            className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_8rem_6rem_auto]"
          >
            <Input
              placeholder="Milestone"
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setValues((current) => ({
                  ...current,
                  milestones: current.milestones.filter((_, i) => i !== index),
                }))
              }
            >
              Remove
            </Button>
          </div>
        ))}
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
