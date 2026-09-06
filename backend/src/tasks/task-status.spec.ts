import { TaskStatus } from '@prisma/client';
import {
  assertValidTaskStatusTransition,
  isValidTaskStatusTransition,
} from './task-status';

describe('task status transitions', () => {
  it('allows start and continue work from assigned, returned, or overdue', () => {
    expect(
      isValidTaskStatusTransition(TaskStatus.TODO, TaskStatus.IN_PROGRESS),
    ).toBe(true);
    expect(
      isValidTaskStatusTransition(TaskStatus.RETURNED, TaskStatus.IN_PROGRESS),
    ).toBe(true);
    expect(
      isValidTaskStatusTransition(TaskStatus.OVERDUE, TaskStatus.IN_PROGRESS),
    ).toBe(true);
  });

  it('blocks raw changes into review or completed', () => {
    expect(
      isValidTaskStatusTransition(TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW),
    ).toBe(false);
    expect(
      isValidTaskStatusTransition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED),
    ).toBe(false);
    expect(
      isValidTaskStatusTransition(TaskStatus.TODO, TaskStatus.COMPLETED),
    ).toBe(false);
    expect(() =>
      assertValidTaskStatusTransition(TaskStatus.TODO, TaskStatus.COMPLETED),
    ).toThrow('COMPLETED can only be set through submit or approval');
    expect(() =>
      assertValidTaskStatusTransition(
        TaskStatus.IN_PROGRESS,
        TaskStatus.IN_REVIEW,
      ),
    ).toThrow('IN_REVIEW can only be set through submit or approval');
  });

  it('allows archiving from active states and restoring archived tasks', () => {
    expect(
      isValidTaskStatusTransition(TaskStatus.TODO, TaskStatus.ARCHIVED),
    ).toBe(true);
    expect(
      isValidTaskStatusTransition(TaskStatus.ARCHIVED, TaskStatus.TODO),
    ).toBe(true);
    expect(
      isValidTaskStatusTransition(TaskStatus.ARCHIVED, TaskStatus.COMPLETED),
    ).toBe(false);
  });

  it('treats same-status updates as valid', () => {
    expect(
      isValidTaskStatusTransition(TaskStatus.IN_REVIEW, TaskStatus.IN_REVIEW),
    ).toBe(true);
  });

  it('does not let completed work become overdue', () => {
    expect(
      isValidTaskStatusTransition(TaskStatus.COMPLETED, TaskStatus.OVERDUE),
    ).toBe(false);
  });
});
