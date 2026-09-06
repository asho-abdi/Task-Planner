"use client";

import Link from "next/link";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Meter } from "@/features/insights/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoals } from "@/features/goals/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function GoalsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const goals = useGoals(workspaceId);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const canWrite = workspace && workspace.role !== "VIEWER";

  return (
    <PageShell>
      <PageHeader
        title="Goals"
        description="Track progress, milestones, and linked projects."
        actions={
          canWrite ? (
            <Button onClick={() => setOpenCreateDialog("goal")}>New goal</Button>
          ) : null
        }
      />
      {goals.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : goals.isError ? (
        <p className="text-sm text-destructive">{goals.error.message}</p>
      ) : (goals.data ?? []).length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Set a goal to connect projects and milestones."
          action={
            canWrite ? (
              <Button onClick={() => setOpenCreateDialog("goal")}>New goal</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(goals.data ?? []).map((goal) => (
            <Link
              key={goal.id}
              href={`/app/goals/${goal.id}`}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40"
            >
              <h2 className="text-base font-semibold tracking-tight">{goal.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {goal.milestones.length} milestones · {goal.projects.length} projects
              </p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{goal.progress}%</span>
              </div>
              <Meter className="mt-2" value={goal.progress} />
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
