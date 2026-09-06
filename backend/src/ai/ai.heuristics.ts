import { SuggestedTask, type AiPriority } from './ai.types';

const PRIORITY_HINTS: Array<{ match: RegExp; priority: AiPriority }> = [
  { match: /\b(urgent|asap|blocker|critical)\b/i, priority: 'URGENT' },
  { match: /\b(high|soon|important)\b/i, priority: 'HIGH' },
  { match: /\b(low|later|someday|nice to have)\b/i, priority: 'LOW' },
];

export function inferPriority(text: string): AiPriority {
  for (const hint of PRIORITY_HINTS) {
    if (hint.match.test(text)) {
      return hint.priority;
    }
  }
  return 'MEDIUM';
}

export function splitWorkItems(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) =>
      line.replace(/^\s*(?:[-*•]|\d+[.)]|\[(?: |x|X)?\])\s*/, '').trim(),
    )
    .filter((line) => line.length >= 3);

  if (lines.length > 1) {
    return uniqueTitles(lines);
  }

  return uniqueTitles(
    text
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 8),
  );
}

function uniqueTitles(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const title = item.replace(/\s+/g, ' ').slice(0, 200);
    const key = title.toLowerCase();
    if (!title || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(title);
    if (result.length >= 8) {
      break;
    }
  }
  return result;
}

export function heuristicPlan(
  prompt: string,
  projectName?: string,
): {
  title: string;
  summary: string;
  tasks: SuggestedTask[];
} {
  const titles = splitWorkItems(prompt);
  const fallback = titles.length
    ? titles
    : [`Clarify scope: ${prompt.slice(0, 80) || 'the request'}`];
  const title = projectName
    ? `Plan for ${projectName}`
    : `Plan: ${prompt.slice(0, 72) || 'work'}`;
  return {
    title,
    summary:
      'Template plan generated without an AI provider. Review and create tasks yourself.',
    tasks: fallback.map((item) => ({
      title: item,
      description: `Derived from the request. Project: ${projectName ?? 'none'}.`,
      priority: inferPriority(`${prompt} ${item}`),
    })),
  };
}

export function heuristicExtract(text: string): { tasks: SuggestedTask[] } {
  const titles = splitWorkItems(text);
  return {
    tasks: titles.map((item) => ({
      title: item,
      description: 'Extracted from the provided notes using a template parser.',
      priority: inferPriority(item),
    })),
  };
}

export function heuristicAssist(
  question: string,
  context?: { title?: string; status?: string },
): { answer: string; suggestions: string[] } {
  const subject = context?.title ? `"${context.title}"` : 'this work';
  const status = context?.status
    ? ` Current status is ${context.status.replaceAll('_', ' ')}.`
    : '';
  return {
    answer: `Template guidance for ${subject}.${status} ${question} This is not an AI-generated answer.`,
    suggestions: [
      'Break the work into a next concrete action.',
      'Confirm owner, due date, and blockers.',
      'Update status after the next check-in.',
    ],
  };
}

export function heuristicPlanDay(
  date: string,
  tasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number | null;
  }>,
  meetings: Array<{ startAt: Date; endAt: Date }>,
): {
  summary: string;
  slots: Array<{
    taskId: string;
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
  }>;
} {
  const dayStart = new Date(`${date}T09:00:00.000Z`);
  const lunchStart = new Date(`${date}T12:00:00.000Z`);
  const lunchEnd = new Date(`${date}T13:00:00.000Z`);
  const dayEnd = new Date(`${date}T17:00:00.000Z`);
  const busy = meetings
    .map((meeting) => ({
      start: meeting.startAt.getTime(),
      end: meeting.endAt.getTime(),
    }))
    .concat([{ start: lunchStart.getTime(), end: lunchEnd.getTime() }])
    .sort((a, b) => a.start - b.start);

  let cursor = dayStart.getTime();
  const slots: Array<{
    taskId: string;
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
  }> = [];

  for (const task of tasks) {
    const durationMs = Math.max(30, task.estimatedMinutes ?? 60) * 60_000;
    while (cursor + durationMs <= dayEnd.getTime()) {
      const overlap = busy.find(
        (block) => cursor < block.end && cursor + durationMs > block.start,
      );
      if (overlap) {
        cursor = Math.max(cursor, overlap.end);
        continue;
      }
      slots.push({
        taskId: task.id,
        title: task.title,
        scheduledStart: new Date(cursor).toISOString(),
        scheduledEnd: new Date(cursor + durationMs).toISOString(),
      });
      cursor += durationMs;
      break;
    }
  }

  return {
    summary: `Packed ${slots.length} open task${slots.length === 1 ? '' : 's'} around meetings for ${date}.`,
    slots,
  };
}

export function heuristicNarrative(input: {
  from: string;
  to: string;
  completionRate: number;
  completed: number;
  open: number;
  overdue: number;
  overloaded: number;
  topProject?: string;
}): {
  headline: string;
  narrative: string;
  highlights: string[];
} {
  const percent = Math.round(input.completionRate * 100);
  return {
    headline: `Completion is ${percent}% from ${input.from} to ${input.to}`,
    narrative: `Template summary, not an AI narrative. ${input.completed} tasks are complete and ${input.open} remain open. There are ${input.overdue} overdue items and ${input.overloaded} overloaded people.`,
    highlights: [
      `${input.overdue} overdue`,
      `${input.overloaded} overloaded`,
      input.topProject
        ? `Watch ${input.topProject}`
        : 'No project stood out in this range',
    ],
  };
}
