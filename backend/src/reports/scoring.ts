import { DependencyType, Priority, TaskStatus } from '@prisma/client';

export const PRIORITY_POINTS: Record<Priority, number> = {
  [Priority.LOW]: 0,
  [Priority.MEDIUM]: 8,
  [Priority.HIGH]: 16,
  [Priority.URGENT]: 24,
};

export const OVERDUE_POINTS = 40;
export const DEADLINE_24H_POINTS = 20;
export const DEADLINE_72H_POINTS = 12;
export const DEADLINE_7D_POINTS = 6;
export const BLOCKED_POINTS = 18;
export const OVERLOAD_POINTS = 12;
export const RISK_MAX = 100;

export const OPEN_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.RETURNED,
  TaskStatus.OVERDUE,
];

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskFactors = {
  overdue: number;
  deadline: number;
  dependency: number;
  workload: number;
  priority: number;
};

export type TaskRiskScore = {
  score: number;
  level: RiskLevel;
  factors: RiskFactors;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function hoursFromMinutes(minutes: number | null | undefined): number {
  if (minutes == null) {
    return 0;
  }
  return Math.round((minutes / 60) * 100) / 100;
}

export function minutesFromHours(hours: number): number {
  return Math.round(hours * 60);
}

export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function parseUtcDate(dateStr: string | undefined, now: Date): Date {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function utcDayRange(day: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
  );
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

export function utcRangeDays(
  from: string | undefined,
  to: string | undefined,
  now: Date,
  defaultDays = 14,
): { start: Date; end: Date } {
  const today = parseUtcDate(undefined, now);
  const end = to
    ? new Date(parseUtcDate(to, now).getTime() + MS_PER_DAY)
    : new Date(today.getTime() + MS_PER_DAY);
  const start = from
    ? parseUtcDate(from, now)
    : new Date(end.getTime() - defaultDays * MS_PER_DAY);
  return { start, end };
}

export function eachUtcDate(start: Date, endExclusive: Date): string[] {
  const days: string[] = [];
  for (
    let cursor = start.getTime();
    cursor < endExclusive.getTime();
    cursor += MS_PER_DAY
  ) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}

export function inRange(
  value: Date | null | undefined,
  start: Date,
  end: Date,
): boolean {
  if (!value) {
    return false;
  }
  const time = value.getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function isOpenTaskStatus(status: TaskStatus): boolean {
  return status !== TaskStatus.COMPLETED && status !== TaskStatus.ARCHIVED;
}

export function isTaskOverdue(
  status: TaskStatus,
  dueDate: Date | null,
  now: Date,
): boolean {
  if (!isOpenTaskStatus(status)) {
    return false;
  }
  if (status === TaskStatus.OVERDUE) {
    return true;
  }
  return dueDate !== null && dueDate.getTime() < now.getTime();
}

export function deadlinePoints(
  dueDate: Date | null,
  now: Date,
  overdue: boolean,
): number {
  if (!dueDate || overdue) {
    return 0;
  }
  const hours = (dueDate.getTime() - now.getTime()) / MS_PER_HOUR;
  if (hours <= 0) {
    return 0;
  }
  if (hours <= 24) {
    return DEADLINE_24H_POINTS;
  }
  if (hours <= 72) {
    return DEADLINE_72H_POINTS;
  }
  if (hours <= 168) {
    return DEADLINE_7D_POINTS;
  }
  return 0;
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) {
    return 'CRITICAL';
  }
  if (score >= 50) {
    return 'HIGH';
  }
  if (score >= 25) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function computeTaskRiskScore(input: {
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  blocked: boolean;
  assigneeOverloaded: boolean;
  now: Date;
}): TaskRiskScore {
  const overdue = isTaskOverdue(input.status, input.dueDate, input.now);
  const factors: RiskFactors = {
    overdue: overdue ? OVERDUE_POINTS : 0,
    deadline: deadlinePoints(input.dueDate, input.now, overdue),
    dependency: input.blocked ? BLOCKED_POINTS : 0,
    workload: input.assigneeOverloaded ? OVERLOAD_POINTS : 0,
    priority: PRIORITY_POINTS[input.priority],
  };
  const score = Math.min(
    RISK_MAX,
    factors.overdue +
      factors.deadline +
      factors.dependency +
      factors.workload +
      factors.priority,
  );
  return {
    score,
    level: riskLevelFromScore(score),
    factors,
  };
}

export type DependencyEdge = {
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
};

export function blockedTaskIds(
  edges: DependencyEdge[],
  incompleteIds: ReadonlySet<string>,
): Set<string> {
  const blocked = new Set<string>();
  for (const edge of edges) {
    if (edge.type === DependencyType.RELATED) {
      continue;
    }
    if (
      edge.type === DependencyType.DEPENDS_ON ||
      edge.type === DependencyType.BLOCKED_BY
    ) {
      if (incompleteIds.has(edge.toTaskId)) {
        blocked.add(edge.fromTaskId);
      }
    } else if (edge.type === DependencyType.BLOCKS) {
      if (incompleteIds.has(edge.fromTaskId)) {
        blocked.add(edge.toTaskId);
      }
    }
  }
  return blocked;
}

export function isOverloaded(
  todayMinutes: number,
  hoursPerDay: number,
): boolean {
  return todayMinutes > minutesFromHours(hoursPerDay);
}

export const PRIORITY_LOAD_WEIGHT: Record<Priority, number> = {
  [Priority.LOW]: 0.75,
  [Priority.MEDIUM]: 1,
  [Priority.HIGH]: 1.35,
  [Priority.URGENT]: 1.7,
};

export const UNESTIMATED_TASK_MINUTES = 60;

export function utcWeekRange(day: Date): { start: Date; end: Date } {
  const { start } = utcDayRange(day);
  const weekday = start.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = new Date(start.getTime() + mondayOffset * MS_PER_DAY);
  return {
    start: weekStart,
    end: new Date(weekStart.getTime() + 7 * MS_PER_DAY),
  };
}
