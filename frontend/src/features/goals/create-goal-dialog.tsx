"use client";

import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { useProjects } from "@/features/projects/hooks";
import { useCreateGoal } from "@/features/goals/hooks";
import {
  emptyGoalForm,
  GoalForm,
  toGoalWriteInput,
} from "@/features/goals/goal-form";
import { useWorkspaceStore } from "@/store/workspace-store";

type CreateGoalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateGoalDialog({
  open,
  onOpenChange,
}: CreateGoalDialogProps) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const projects = useProjects(workspaceId, false, open);
  const createGoal = useCreateGoal();

  return (
    <CreateResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New goal"
      description="Add a goal. Linked projects load in the background."
    >
      <GoalForm
        key={open ? "open" : "closed"}
        initial={emptyGoalForm()}
        projects={projects}
        submitting={createGoal.isPending}
        submitLabel="Create"
        error={createGoal.error?.message}
        onSubmit={async (values) => {
          try {
            await createGoal.mutateAsync(toGoalWriteInput(values));
            onOpenChange(false);
          } catch {
            // Error is shown from the mutation.
          }
        }}
      />
    </CreateResourceDialog>
  );
}
