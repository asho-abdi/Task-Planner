import { DependencyType, Priority, TaskStatus } from '@prisma/client';
import { parseWorkloadHoursPerDay } from '../config/configuration';
import {
  BLOCKED_POINTS,
  blockedTaskIds,
  computeTaskRiskScore,
  DEADLINE_24H_POINTS,
  hoursFromMinutes,
  isOverloaded,
  minutesFromHours,
  OVERDUE_POINTS,
  parseUtcDate,
  utcDayRange,
  utcRangeDays,
} from './scoring';

describe('scoring', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');

  it('converts minutes and hours with integer rounding', () => {
    expect(hoursFromMinutes(90)).toBe(1.5);
    expect(hoursFromMinutes(null)).toBe(0);
    expect(minutesFromHours(8)).toBe(480);
  });

  it('treats missing WORKLOAD_HOURS_PER_DAY as 8', () => {
    expect(parseWorkloadHoursPerDay(undefined)).toBe(8);
    expect(parseWorkloadHoursPerDay('0')).toBe(8);
    expect(parseWorkloadHoursPerDay('6.5')).toBe(6.5);
  });

  it('parses a UTC calendar day from YYYY-MM-DD', () => {
    const day = parseUtcDate('2026-08-29', now);
    const { start, end } = utcDayRange(day);
    expect(start.toISOString()).toBe('2026-08-29T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-30T00:00:00.000Z');
  });

  it('defaults the report window to 14 UTC days ending tomorrow', () => {
    const range = utcRangeDays(undefined, undefined, now, 14);
    expect(range.start.toISOString()).toBe('2026-08-16T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-08-30T00:00:00.000Z');
  });

  it('scores overdue urgent blocked work at a critical level', () => {
    const result = computeTaskRiskScore({
      status: TaskStatus.OVERDUE,
      priority: Priority.URGENT,
      dueDate: new Date('2026-08-28T12:00:00.000Z'),
      blocked: true,
      assigneeOverloaded: true,
      now,
    });
    expect(result.factors.overdue).toBe(OVERDUE_POINTS);
    expect(result.factors.deadline).toBe(0);
    expect(result.factors.dependency).toBe(BLOCKED_POINTS);
    expect(result.score).toBe(40 + 18 + 12 + 24);
    expect(result.level).toBe('CRITICAL');
  });

  it('adds deadline points for work due within 24 hours', () => {
    const result = computeTaskRiskScore({
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      dueDate: new Date('2026-08-29T20:00:00.000Z'),
      blocked: false,
      assigneeOverloaded: false,
      now,
    });
    expect(result.factors.deadline).toBe(DEADLINE_24H_POINTS);
    expect(result.factors.overdue).toBe(0);
    expect(result.score).toBe(20 + 8);
    expect(result.level).toBe('MEDIUM');
  });

  it('does not treat completed tasks as overdue', () => {
    const result = computeTaskRiskScore({
      status: TaskStatus.COMPLETED,
      priority: Priority.HIGH,
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
      blocked: false,
      assigneeOverloaded: false,
      now,
    });
    expect(result.factors.overdue).toBe(0);
    expect(result.score).toBe(16);
    expect(result.level).toBe('LOW');
  });

  it('marks a task blocked by incomplete DEPENDS_ON, BLOCKED_BY, and BLOCKS edges', () => {
    const incomplete = new Set(['pred-1', 'pred-2', 'pred-3']);
    const blocked = blockedTaskIds(
      [
        {
          fromTaskId: 'a',
          toTaskId: 'pred-1',
          type: DependencyType.DEPENDS_ON,
        },
        {
          fromTaskId: 'b',
          toTaskId: 'pred-2',
          type: DependencyType.BLOCKED_BY,
        },
        {
          fromTaskId: 'pred-3',
          toTaskId: 'c',
          type: DependencyType.BLOCKS,
        },
        {
          fromTaskId: 'd',
          toTaskId: 'pred-1',
          type: DependencyType.RELATED,
        },
      ],
      incomplete,
    );
    expect([...blocked].sort()).toEqual(['a', 'b', 'c']);
  });

  it('detects overload only when today minutes exceed daily capacity', () => {
    expect(isOverloaded(480, 8)).toBe(false);
    expect(isOverloaded(481, 8)).toBe(true);
  });
});
