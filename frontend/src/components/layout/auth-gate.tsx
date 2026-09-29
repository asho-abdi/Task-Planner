"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CreateGoalDialog } from "@/features/goals/create-goal-dialog";
import { CreateMeetingDialog } from "@/features/meetings/create-meeting-dialog";
import { CreateProjectDialog } from "@/features/projects/create-project-dialog";
import { CreateTaskDialog } from "@/features/tasks/create-task-dialog";
import { CreateTodoDialog } from "@/features/todos/create-todo-dialog";
import { CreateWorkspaceDialog } from "@/features/workspaces/create-workspace-dialog";
import { WorkspaceGate } from "@/components/layout/workspace-gate";
import { RealtimeProvider } from "@/features/chat/realtime-provider";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useUiStore } from "@/store/ui-store";
import { AppLoadingScreen } from "@/components/layout/app-loading";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useRequireAuth();
  const openCreateDialog = useUiStore((state) => state.openCreateDialog);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);

  if (isLoading || !user) {
    return <AppLoadingScreen />;
  }

  return (
    <WorkspaceGate>
      <RealtimeProvider>
      <AppShell user={user}>
        {children}
        <CreateWorkspaceDialog
          open={openCreateDialog === "workspace"}
          onOpenChange={(open) =>
            setOpenCreateDialog(open ? "workspace" : null)
          }
        />
        <CreateProjectDialog
          open={openCreateDialog === "project"}
          onOpenChange={(open) =>
            setOpenCreateDialog(open ? "project" : null)
          }
        />
        <CreateTaskDialog
          open={openCreateDialog === "task"}
          onOpenChange={(open) =>
            setOpenCreateDialog(open ? "task" : null)
          }
        />
        <CreateMeetingDialog
          open={openCreateDialog === "meeting"}
          onOpenChange={(open) =>
            setOpenCreateDialog(open ? "meeting" : null)
          }
        />
        <CreateTodoDialog
          open={openCreateDialog === "todo"}
          onOpenChange={(open) => setOpenCreateDialog(open ? "todo" : null)}
        />
        <CreateGoalDialog
          open={openCreateDialog === "goal"}
          onOpenChange={(open) => setOpenCreateDialog(open ? "goal" : null)}
        />
      </AppShell>
      </RealtimeProvider>
    </WorkspaceGate>
  );
}
