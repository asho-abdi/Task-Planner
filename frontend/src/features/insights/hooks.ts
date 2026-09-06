"use client";

import { useQuery } from "@tanstack/react-query";
import * as insightsApi from "@/features/insights/api";
import type { PageParams } from "@/features/insights/types";

export const insightKeys = {
  all: (workspaceId: string) => ["insights", workspaceId] as const,
  myDay: (workspaceId: string, date: string) =>
    [...insightKeys.all(workspaceId), "my-day", date] as const,
  workload: (workspaceId: string, params: PageParams) =>
    [...insightKeys.all(workspaceId), "workload", params] as const,
  risk: (workspaceId: string, params: PageParams) =>
    [...insightKeys.all(workspaceId), "risk", params] as const,
  reports: (workspaceId: string, params: PageParams) =>
    [...insightKeys.all(workspaceId), "reports", params] as const,
  dashboard: (workspaceId: string) =>
    [...insightKeys.all(workspaceId), "dashboard"] as const,
};

export function useMyDay(workspaceId: string | null, date: string) {
  return useQuery({
    queryKey: insightKeys.myDay(workspaceId ?? "none", date),
    queryFn: () => insightsApi.getMyDay({ date }),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useWorkload(workspaceId: string | null, params: PageParams) {
  return useQuery({
    queryKey: insightKeys.workload(workspaceId ?? "none", params),
    queryFn: () => insightsApi.getWorkload(params),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useRisk(workspaceId: string | null, params: PageParams) {
  return useQuery({
    queryKey: insightKeys.risk(workspaceId ?? "none", params),
    queryFn: () => insightsApi.getRisk(params),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useReports(workspaceId: string | null, params: PageParams) {
  return useQuery({
    queryKey: insightKeys.reports(workspaceId ?? "none", params),
    queryFn: () => insightsApi.getReports(params),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

export function useDashboard(workspaceId: string | null) {
  return useQuery({
    queryKey: insightKeys.dashboard(workspaceId ?? "none"),
    queryFn: insightsApi.getDashboard,
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}
