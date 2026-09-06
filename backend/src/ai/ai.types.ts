export type AiUnavailableReason =
  | 'missing_key'
  | 'timeout'
  | 'provider_error'
  | 'invalid_response'
  | 'rate_limit';

export type AiSource = 'ai' | 'heuristic';

export type AiPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

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

export type CompleteResult =
  { ok: true; data: unknown } | { ok: false; reason: AiUnavailableReason };

export function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || name === 'TimeoutError';
}

export function parseJsonContent(content: unknown): unknown {
  if (typeof content !== 'string' || !content.trim()) {
    return undefined;
  }
  const trimmed = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

export function asPriority(value: unknown): AiPriority {
  if (
    value === 'LOW' ||
    value === 'MEDIUM' ||
    value === 'HIGH' ||
    value === 'URGENT'
  ) {
    return value;
  }
  return 'MEDIUM';
}

export function asTrimmedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function asSuggestedTasks(value: unknown): SuggestedTask[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const title = asTrimmedString(record.title);
      if (!title) {
        return null;
      }
      const suggested: SuggestedTask = {
        title: title.slice(0, 200),
        description: asTrimmedString(record.description).slice(0, 5000),
        priority: asPriority(record.priority),
      };
      const hours = Number(record.estimatedHours);
      if (Number.isFinite(hours) && hours >= 0 && hours <= 1000) {
        suggested.estimatedHours = hours;
      }
      const dueDate = asTrimmedString(record.dueDate);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        suggested.dueDate = dueDate;
      }
      return suggested;
    })
    .filter((item): item is SuggestedTask => item !== null)
    .slice(0, 12);
}
