"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Flag,
  FolderKanban,
  Gauge,
  Plus,
  Target,
} from "lucide-react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatCard,
  Surface,
} from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { Progress, ProgressRing, progressTone } from "@/components/ui/progress";
import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";
import { useGoals } from "@/features/goals/hooks";
import type { Goal } from "@/features/goals/types";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { cn, formatDate } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

function isGoalOverdue(goal: Goal) {
  if (!goal.targetDate || goal.progress >= 100) return false;
  return new Date(goal.targetDate).getTime() < Date.now();
}

function GoalCard({ goal }: { goal: Goal }) {
  const overdue = isGoalOverdue(goal);
  const done = goal.progress >= 100;
  return (
    <Link
      href={`/app/goals/${goal.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card interactive className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <ProgressRing value={goal.progress} size={52} stroke={5}>
            <span className="text-xs text-foreground">{goal.progress}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="line-clamp-2 text-md font-semibold tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
                {goal.title}
              </h2>
              {done ? (
                <Badge variant="success" dot className="shrink-0">
                  Achieved
                </Badge>
              ) : overdue ? (
                <Badge variant="danger" dot className="shrink-0">
                  Past target
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {goal.description || "No description yet."}
            </p>
          </div>
        </div>
        <Progress
          className="mt-4"
          value={goal.progress}
          tone={progressTone(goal.progress)}
          size="sm"
          aria-label={`${goal.title} progress`}
        />
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 tabular">
              <FolderKanban className="size-3.5" />
              {goal.projects.length} {goal.projects.length === 1 ? "project" : "projects"}
            </span>
            <span className="inline-flex items-center gap-1 tabular">
              <Flag className="size-3.5" />
              {goal.milestones.length}{" "}
              {goal.milestones.length === 1 ? "milestone" : "milestones"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular",
                overdue && "text-danger-soft-foreground",
              )}
            >
              <CalendarDays className="size-3.5" />
              {goal.targetDate ? formatDate(goal.targetDate) : "No target"}
            </span>
          </div>
          <Avatar name={goal.owner.name} size="xs" title={`Owner: ${goal.owner.name}`} />
        </div>
      </Card>
    </Link>
  );
}

export default function GoalsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const goals = useGoals(workspaceId);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const canWrite = workspace && workspace.role !== "VIEWER";
  const items = goals.data ?? [];
  const achieved = items.filter((goal) => goal.progress >= 100).length;
  const average = items.length
    ? Math.round(items.reduce((sum, goal) => sum + goal.progress, 0) / items.length)
    : 0;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Goals"
        icon={Target}
        description="Track progress, milestones, and linked projects."
        actions={
          canWrite ? (
            <Button size="sm" onClick={() => setOpenCreateDialog("goal")}>
              <Plus />
              New goal
            </Button>
          ) : null
        }
      />
      {goals.isLoading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <SkeletonCards count={6} className="sm:grid-cols-2 lg:grid-cols-3" />
        </>
      ) : goals.isError ? (
        <ErrorState
          title="Couldn't load goals"
          description={goals.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void goals.refetch()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <Surface className="p-0 sm:p-0">
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Set a goal to connect projects and milestones."
            action={
              canWrite ? (
                <Button size="sm" onClick={() => setOpenCreateDialog("goal")}>
                  <Plus />
                  New goal
                </Button>
              ) : undefined
            }
          />
        </Surface>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Goals" value={items.length} icon={Target} tone="primary" />
            <StatCard
              label="Average progress"
              value={`${average}%`}
              icon={Gauge}
              tone="info"
            />
            <StatCard
              label="Achieved"
              value={achieved}
              icon={CheckCircle2}
              tone="success"
              hint={`${items.length - achieved} still in progress`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
