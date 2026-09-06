import { apiRequest } from "@/lib/api-client";
import type { Goal, GoalWriteInput } from "@/features/goals/types";

export function listGoals() {
  return apiRequest<Goal[]>("/goals");
}

export function getGoal(goalId: string) {
  return apiRequest<Goal>(`/goals/${goalId}`);
}

export function createGoal(input: GoalWriteInput) {
  return apiRequest<Goal>("/goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGoal(goalId: string, input: GoalWriteInput) {
  return apiRequest<Goal>(`/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
