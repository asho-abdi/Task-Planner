"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as goalsApi from "@/features/goals/api";
import { projectKeys } from "@/features/projects/hooks";
import type { GoalWriteInput } from "@/features/goals/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export const goalKeys = {
  all: (workspaceId: string) => ["goals", workspaceId] as const,
};

function useInvalidateGoals() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return () => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({ queryKey: goalKeys.all(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: projectKeys.all(workspaceId) });
  };
}

export function useGoals(workspaceId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...goalKeys.all(workspaceId ?? "none"), "list"],
    queryFn: goalsApi.listGoals,
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 60_000,
  });
}

export function useGoal(workspaceId: string | null, goalId: string) {
  return useQuery({
    queryKey: [...goalKeys.all(workspaceId ?? "none"), "detail", goalId],
    queryFn: () => goalsApi.getGoal(goalId),
    enabled: Boolean(workspaceId) && Boolean(goalId),
    staleTime: 60_000,
  });
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: goalsApi.createGoal,
    onSuccess: invalidate,
  });
}

export function useUpdateGoal(goalId: string) {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (input: GoalWriteInput) => goalsApi.updateGoal(goalId, input),
    onSuccess: invalidate,
  });
}
