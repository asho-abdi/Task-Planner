"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  Flag,
  FolderKanban,
  Pencil,
  Target,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  SectionTitle,
  Surface,
} from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { Progress, ProgressRing, progressTone } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useProjects } from "@/features/projects/hooks";
import { useGoal, useUpdateGoal } from "@/features/goals/hooks";
import {
  GoalForm,
  goalToFormValues,
  toGoalWriteInput,
} from "@/features/goals/goal-form";
import type { Goal } from "@/features/goals/types";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { cn, formatDate } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

function isGoalOverdue(goal: Goal) {
  if (!goal.targetDate || goal.progress >= 100) return false;
  return new Date(goal.targetDate).getTime() < Date.now();
}

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
      <PageShell width="wide">
        <div role="status" aria-label="Loading goal" className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!goal.data) {
    return (
      <PageShell>
        {goal.isError ? (
          <ErrorState
            title="Couldn't load this goal"
            description={goal.error.message}
            action={
              <Button size="sm" variant="outline" onClick={() => void goal.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Target}
            title="Goal not found"
            description="It may have been deleted, or you no longer have access."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/app/goals">Back to goals</Link>
              </Button>
            }
          />
        )}
      </PageShell>
    );
  }

  const item = goal.data;
  const overdue = isGoalOverdue(item);
  const linkedProjects = item.projects ?? [];
  const goalMilestones = item.milestones ?? [];
  const linkedTasks = item.tasks ?? [];

  return (
    <PageShell width="wide">
      <PageHeader
        title={item.title}
        breadcrumbs={[
          { label: "Goals", href: "/app/goals" },
          { label: item.title },
        ]}
        description={item.description || undefined}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={item.owner.name} size="xs" />
              {item.owner.name}
            </span>
            <span aria-hidden className="text-subtle-foreground">·</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular",
                overdue && "text-danger-soft-foreground",
              )}
            >
              <CalendarDays className="size-3.5" />
              {item.targetDate ? `Target ${formatDate(item.targetDate)}` : "No target date"}
            </span>
            {item.progress >= 100 ? (
              <Badge variant="success" dot>
                Achieved
              </Badge>
            ) : overdue ? (
              <Badge variant="danger" dot>
                Past target
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <SectionTitle description="Goal → Project → Milestone → Task">
              Linked projects
            </SectionTitle>
            {linkedProjects.length === 0 ? (
              <Surface className="p-0 sm:p-0">
                <EmptyState
                  compact
                  icon={FolderKanban}
                  title="No linked projects"
                  description="Link projects in the form below to roll their progress up here."
                />
              </Surface>
            ) : (
              <div className="grid gap-3">
                {linkedProjects.map((project) => (
                  <Card key={project.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-sm font-semibold text-primary-soft-foreground">
                        {project.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/app/projects/${project.id}`}
                            className="truncate rounded-sm text-base font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {project.name}
                          </Link>
                          <StatusBadge value={project.status} />
                        </div>
                        <p className="text-xs text-muted-foreground tabular">
                          {project.taskCount ?? 0}{" "}
                          {(project.taskCount ?? 0) === 1 ? "task" : "tasks"}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress
                            value={project.progress ?? 0}
                            tone={progressTone(project.progress ?? 0)}
                            aria-label={`${project.name} progress`}
                          />
                          <span className="w-10 shrink-0 text-right text-xs font-medium text-foreground tabular">
                            {project.progress ?? 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {(project.milestones ?? []).length ? (
                      <ul className="mt-3 space-y-2 border-l border-border pl-4 sm:ml-11">
                        {(project.milestones ?? []).map((milestone) => (
                          <li
                            key={milestone.id}
                            className="flex items-center gap-3 text-sm"
                          >
                            <Flag className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-foreground">
                              {milestone.title}
                            </span>
                            <Progress
                              className="hidden w-24 sm:block"
                              size="sm"
                              value={milestone.progress}
                              tone={progressTone(milestone.progress)}
                              aria-label={`${milestone.title} progress`}
                            />
                            <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular">
                              {milestone.progress}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </section>

          {goalMilestones.length ? (
            <section className="space-y-3">
              <SectionTitle>Goal milestones</SectionTitle>
              <ListPanel className="divide-y divide-border">
                {goalMilestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md",
                        milestone.progress >= 100
                          ? "bg-success-soft text-success-soft-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Flag className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-foreground">
                        {milestone.title}
                      </p>
                      <p className="text-xs text-muted-foreground tabular">
                        {milestone.dueDate ? formatDate(milestone.dueDate) : "No date"}
                      </p>
                    </div>
                    <Progress
                      className="hidden w-32 sm:block"
                      value={milestone.progress}
                      tone={progressTone(milestone.progress)}
                      aria-label={`${milestone.title} progress`}
                    />
                    <span className="w-10 shrink-0 text-right text-sm font-medium text-foreground tabular">
                      {milestone.progress}%
                    </span>
                  </div>
                ))}
              </ListPanel>
            </section>
          ) : null}

          {linkedTasks.length ? (
            <section className="space-y-3">
              <SectionTitle>Linked tasks</SectionTitle>
              <ListPanel className="divide-y divide-border">
                {linkedTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/app/tasks/${task.id}`}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <CheckSquare className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-base text-foreground group-hover:text-primary">
                      {task.title}
                    </span>
                    <StatusBadge value={task.status} className="shrink-0" />
                  </Link>
                ))}
              </ListPanel>
            </section>
          ) : null}
        </div>

        <aside className="order-first space-y-4 lg:order-none">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <ProgressRing value={item.progress} size={88} stroke={8}>
                <span className="font-heading text-xl text-foreground">
                  {item.progress}%
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Overall progress</p>
                <p className="mt-0.5 text-base font-medium text-foreground">
                  {item.progress >= 100
                    ? "Goal achieved"
                    : `${100 - item.progress}% to go`}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Projects</dt>
                <dd className="font-heading text-xl font-semibold text-foreground tabular">
                  {linkedProjects.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Milestones</dt>
                <dd className="font-heading text-xl font-semibold text-foreground tabular">
                  {goalMilestones.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tasks</dt>
                <dd className="font-heading text-xl font-semibold text-foreground tabular">
                  {linkedTasks.length}
                </dd>
              </div>
            </dl>
          </Card>
          <Card className="p-4 sm:p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                  <Avatar name={item.owner.name} size="xs" />
                  <span className="truncate">{item.owner.name}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Target date</dt>
                <dd
                  className={cn(
                    "font-medium tabular",
                    overdue ? "text-danger-soft-foreground" : "text-foreground",
                  )}
                >
                  {formatDate(item.targetDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium text-foreground tabular">
                  {formatDate(item.createdAt)}
                </dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-muted-foreground" />
              Edit goal
            </CardTitle>
            <CardDescription>
              Update the target, progress, linked projects and milestones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoalForm
              key={item.updatedAt}
              initial={goalToFormValues(item)}
              projects={projects}
              submitting={updateGoal.isPending}
              submitLabel="Save changes"
              autoFocusTitle={false}
              error={updateGoal.error?.message}
              onSubmit={async (values) => {
                await updateGoal.mutateAsync(toGoalWriteInput(values));
                toast.success("Goal updated");
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">View only.</p>
      )}
    </PageShell>
  );
}
