export type AiSource = "ai" | "heuristic";

export type AiUnavailableReason =
  | "missing_key"
  | "timeout"
  | "provider_error"
  | "invalid_response"
  | "rate_limit";

export type AiPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type SuggestedTask = {
  title: string;
  description: string;
  priority: AiPriority;
  estimatedHours?: number;
  dueDate?: string;
};

export type AiEnvelope = {
  source: AiSource;
  unavailableReason?: AiUnavailableReason;
};

export type AiStatus = {
  enabled: boolean;
  source: AiSource;
};

export type AiPlan = AiEnvelope & {
  title: string;
  summary: string;
  tasks: SuggestedTask[];
};

export type AiAssist = AiEnvelope & {
  answer: string;
  suggestions: string[];
};

export type AiExtract = AiEnvelope & {
  tasks: SuggestedTask[];
};

export type AiNarrative = AiEnvelope & {
  headline: string;
  narrative: string;
  highlights: string[];
};
