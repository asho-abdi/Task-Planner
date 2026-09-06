"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, PageShell, Surface } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Meter } from "@/features/insights/ui";
import { useProjects } from "@/features/projects/hooks";
import { useGoal, useUpdateGoal } from "@/features/goals/hooks";
import {
  GoalForm,
  goalToFormValues,
  toGoalWriteInput,
} from "@/features/goals/goal-form";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function GoalDetailPage() {
  const params = useParams<{ goalId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const goal = useGoal(workspaceId, params.goalId);
  const projects = useProjects(workspaceId);
  const updateGoal = useUpdateGoal(params.goalId);
  const canWrite = workspace && workspace.role !== "VIEWER";

  if (goal.isLoading) {
    return (
      <PageShell className="max-w-3xl">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (!goal.data) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Goal not found.</p>
      </PageShell>
    );
  }

  const item = goal.data;

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title={item.title}
        backHref="/app/goals"
        backLabel="Back to goals"
        description={`Owned by ${item.owner.name}`}
      />
      <Surface>
        <p className="text-sm text-muted-foreground">Progress</p>
        <p className="mt-1 text-2xl font-semibold">{item.progress}%</p>
        <Meter className="mt-3" value={item.progress} />
      </Surface>
      <Surface>
        <p className="text-sm font-medium">Goal structure</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Goal → Project → Milestone → Task
        </p>
        <ol className="mt-4 space-y-4">
          {(item.projects ?? []).map((project) => (
            <li key={project.id}>
              <Link
                href={`/app/projects/${project.id}`}
                className="font-medium hover:text-primary"
              >
                {project.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                Project · {project.progress ?? 0}% · {project.taskCount ?? 0} tasks
              </p>
              <ul className="mt-2 ml-4 space-y-2 border-l border-border pl-3">
                {(project.milestones ?? []).map((milestone) => (
                  <li key={milestone.id}>
                    <p className="text-sm">{milestone.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Milestone · {milestone.progress}%
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {(item.milestones ?? []).length ? (
            <li>
              <p className="font-medium">Goal milestones</p>
              <ul className="mt-2 ml-4 space-y-2 border-l border-border pl-3">
                {item.milestones.map((milestone) => (
                  <li key={milestone.id} className="text-sm">
                    {milestone.title} · {milestone.progress}%
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
          {(item.tasks ?? []).length ? (
            <li>
              <p className="font-medium">Linked tasks</p>
              <ul className="mt-2 ml-4 space-y-2 border-l border-border pl-3">
                {(item.tasks ?? []).map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/app/tasks/${task.id}`}
                      className="text-sm hover:text-primary"
                    >
                      {task.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ol>
      </Surface>
      {canWrite ? (
        <Surface>
        <GoalForm
          key={item.updatedAt}
          initial={goalToFormValues(item)}
          projects={projects}
          submitting={updateGoal.isPending}
          submitLabel="Save"
          error={updateGoal.error?.message}
          onSubmit={async (values) => {
            await updateGoal.mutateAsync(toGoalWriteInput(values));
          }}
        />
        </Surface>
      ) : (
        <p className="text-sm text-muted-foreground">View only.</p>
      )}
    </PageShell>
  );
}
