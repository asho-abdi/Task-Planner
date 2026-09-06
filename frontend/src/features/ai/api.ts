import { apiRequest } from "@/lib/api-client";
import type {
  AiAssist,
  AiExtract,
  AiNarrative,
  AiPlan,
  AiStatus,
} from "@/features/ai/types";

export function getAiStatus() {
  return apiRequest<AiStatus>("/ai/status");
}

export function generatePlan(input: { prompt: string; projectId?: string }) {
  return apiRequest<AiPlan>("/ai/plan", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function assistWithAi(input: {
  question: string;
  taskId?: string;
  projectId?: string;
}) {
  return apiRequest<AiAssist>("/ai/assist", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function extractTasks(input: { text?: string; meetingId?: string }) {
  return apiRequest<AiExtract>("/ai/extract", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function generateReportNarrative(input: { from?: string; to?: string }) {
  return apiRequest<AiNarrative>("/ai/report-narrative", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
