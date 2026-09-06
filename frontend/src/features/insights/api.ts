import { apiRequest } from "@/lib/api-client";
import type {
  DashboardResponse,
  MyDayResponse,
  PageParams,
  ReportsResponse,
  RiskResponse,
  WorkloadResponse,
} from "@/features/insights/types";

function toQuery(params: PageParams) {
  const search = new URLSearchParams();
  if (params.date) search.set("date", params.date);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.teamId) search.set("teamId", params.teamId);
  if (params.userId) search.set("userId", params.userId);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getMyDay(params: PageParams) {
  return apiRequest<MyDayResponse>(`/my-day${toQuery(params)}`);
}

export function getWorkload(params: PageParams) {
  return apiRequest<WorkloadResponse>(`/workload${toQuery(params)}`);
}

export function getRisk(params: PageParams) {
  return apiRequest<RiskResponse>(`/risk${toQuery(params)}`);
}

export function getReports(params: PageParams) {
  return apiRequest<ReportsResponse>(`/reports${toQuery(params)}`);
}

export function getDashboard() {
  return apiRequest<DashboardResponse>("/dashboard");
}
