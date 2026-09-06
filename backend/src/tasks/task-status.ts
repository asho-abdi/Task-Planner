import { BadRequestException } from '@nestjs/common';
import { SubmissionStatus, TaskStatus } from '@prisma/client';

/** Raw PATCH / status changes. IN_REVIEW and COMPLETED are workflow-only. */
export const TASK_STATUS_TRANSITIONS: Record<
  TaskStatus,
  readonly TaskStatus[]
> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.ARCHIVED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.ARCHIVED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.ARCHIVED],
  [TaskStatus.RETURNED]: [TaskStatus.IN_PROGRESS, TaskStatus.ARCHIVED],
  [TaskStatus.COMPLETED]: [TaskStatus.ARCHIVED],
  [TaskStatus.OVERDUE]: [TaskStatus.IN_PROGRESS, TaskStatus.ARCHIVED],
  [TaskStatus.ARCHIVED]: [TaskStatus.TODO],
};

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.RETURNED,
];

export const SUBMITTABLE_STATUSES: TaskStatus[] = [
  TaskStatus.IN_PROGRESS,
  TaskStatus.RETURNED,
  TaskStatus.OVERDUE,
  TaskStatus.IN_REVIEW,
];

export const WORKFLOW_LOCKED_STATUSES: TaskStatus[] = [
  TaskStatus.IN_REVIEW,
  TaskStatus.COMPLETED,
];

/** Task is completed only when every assignee's latest work is approved. */
export function resolveCollaborativeTaskStatus(
  assigneeIds: string[],
  latestByAssignee: Map<string, SubmissionStatus>,
  current: TaskStatus,
): TaskStatus {
  const people = assigneeIds.length
    ? assigneeIds
    : [...latestByAssignee.keys()];
  if (
    people.length > 0 &&
    people.every(
      (id) => latestByAssignee.get(id) === SubmissionStatus.APPROVED,
    )
  ) {
    return TaskStatus.COMPLETED;
  }
  if (
    people.some(
      (id) => latestByAssignee.get(id) === SubmissionStatus.SUBMITTED,
    )
  ) {
    return TaskStatus.IN_REVIEW;
  }
  if (
    people.some((id) => latestByAssignee.get(id) === SubmissionStatus.RETURNED)
  ) {
    return TaskStatus.RETURNED;
  }
  const incompleteCollaboration =
    people.length > 1 &&
    people.some((id) => latestByAssignee.has(id)) &&
    !people.every(
      (id) => latestByAssignee.get(id) === SubmissionStatus.APPROVED,
    );
  if (current === TaskStatus.COMPLETED && !incompleteCollaboration) {
    return TaskStatus.COMPLETED;
  }
  if (current === TaskStatus.OVERDUE) {
    return TaskStatus.OVERDUE;
  }
  if (
    current === TaskStatus.IN_PROGRESS ||
    current === TaskStatus.IN_REVIEW ||
    current === TaskStatus.COMPLETED ||
    latestByAssignee.size > 0
  ) {
    return TaskStatus.IN_PROGRESS;
  }
  return current;
}

export function isValidTaskStatusTransition(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return TASK_STATUS_TRANSITIONS[from].includes(to);
}

export function assertValidTaskStatusTransition(
  from: TaskStatus,
  to: TaskStatus,
): void {
  if (WORKFLOW_LOCKED_STATUSES.includes(to) && from !== to) {
    throw new BadRequestException(
      `${to} can only be set through submit or approval`,
    );
  }
  if (!isValidTaskStatusTransition(from, to)) {
    throw new BadRequestException(
      `Cannot change task status from ${from} to ${to}`,
    );
  }
}
