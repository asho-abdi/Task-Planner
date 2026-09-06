"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import * as aiApi from "@/features/ai/api";
export const aiKeys = {
  status: (workspaceId: string) => ["ai", workspaceId, "status"] as const,
};

export function useAiStatus(workspaceId: string | null) {
  return useQuery({
    queryKey: aiKeys.status(workspaceId ?? "none"),
    queryFn: aiApi.getAiStatus,
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

export function useGeneratePlan() {
  return useMutation({ mutationFn: aiApi.generatePlan });
}

export function useAiAssist() {
  return useMutation({ mutationFn: aiApi.assistWithAi });
}

export function useExtractTasks() {
  return useMutation({ mutationFn: aiApi.extractTasks });
}

export function useReportNarrative() {
  return useMutation({ mutationFn: aiApi.generateReportNarrative });
}
