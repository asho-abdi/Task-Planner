import { MeetingRecurrence, MeetingStatus } from '@prisma/client';

export type RecurringMeeting = {
  startAt: Date;
  endAt: Date;
  recurrence: MeetingRecurrence;
  recurrenceUntil: Date | null;
  recurrenceWeekdays: number[];
  status?: MeetingStatus;
};

export function expandMeetingOccurrences(
  meeting: RecurringMeeting,
  from: Date,
  to: Date,
): Date[] {
  const duration = meeting.endAt.getTime() - meeting.startAt.getTime();
  if (duration <= 0) {
    return [];
  }
  const until = meeting.recurrenceUntil
    ? new Date(Math.min(meeting.recurrenceUntil.getTime(), to.getTime()))
    : to;
  if (meeting.recurrence === MeetingRecurrence.NONE) {
    return meeting.startAt >= from && meeting.startAt <= to
      ? [meeting.startAt]
      : [];
  }
  const starts: Date[] = [];
  let cursor = new Date(meeting.startAt);
  let guard = 0;
  const weekdays = meeting.recurrenceWeekdays.length
    ? meeting.recurrenceWeekdays
    : [meeting.startAt.getUTCDay()];
  while (cursor.getTime() <= until.getTime() && guard < 400) {
    guard += 1;
    const matches =
      meeting.recurrence === MeetingRecurrence.CUSTOM
        ? weekdays.includes(cursor.getUTCDay())
        : true;
    if (matches && cursor >= from && cursor <= to) {
      starts.push(new Date(cursor));
    }
    const next = nextOccurrence(cursor, meeting.recurrence, weekdays);
    if (next.getTime() <= cursor.getTime()) {
      break;
    }
    cursor = next;
  }
  return starts;
}

function nextOccurrence(
  from: Date,
  rule: MeetingRecurrence,
  weekdays: number[],
) {
  const next = new Date(from);
  if (rule === MeetingRecurrence.DAILY) {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (rule === MeetingRecurrence.WEEKLY) {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  if (rule === MeetingRecurrence.MONTHLY) {
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }
  for (let i = 1; i <= 7; i += 1) {
    const candidate = new Date(from);
    candidate.setUTCDate(candidate.getUTCDate() + i);
    if (weekdays.includes(candidate.getUTCDay())) {
      return candidate;
    }
  }
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
