import { PRIORITIES, type Priority } from "@/features/projects/types";

export const MEETING_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const MEETING_MODES = ["ONLINE", "OFFLINE"] as const;
export const MEETING_PROVIDERS = [
  "GOOGLE_MEET",
  "ZOOM",
  "MICROSOFT_TEAMS",
  "CUSTOM",
] as const;
export const MEETING_RESPONSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "MAYBE",
] as const;
export const MEETING_RANGES = ["upcoming", "today", "week", "past"] as const;
export const MEETING_RECURRENCES = [
  "NONE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "CUSTOM",
] as const;
export const REMIND_MINUTE_OPTIONS = [15, 30, 60, 1440] as const;
export const CALENDAR_EVENT_TYPES = [
  "meeting",
  "task",
  "deadline",
  "milestone",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];
export type MeetingMode = (typeof MEETING_MODES)[number];
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];
export type MeetingResponse = (typeof MEETING_RESPONSES)[number];
export type MeetingRange = (typeof MEETING_RANGES)[number];
export type MeetingRecurrence = (typeof MEETING_RECURRENCES)[number];
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];
export type MeetingParticipantKind = "REQUIRED" | "OPTIONAL";
export type { Priority };

export type Person = {
  id: string;
  name: string;
  email: string;
};

export type MeetingAgendaItem = {
  id: string;
  title: string;
  position: number;
};

export type MeetingParticipant = Person & {
  userId: string;
  kind: MeetingParticipantKind;
  response: MeetingResponse;
  respondedAt: string | null;
  user?: Person;
};

export type MeetingActionItem = {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  done: boolean;
  taskId: string | null;
  position: number;
  assignee: Person | null;
  task: { id: string; title: string; status: string } | null;
};

export type LinkedMeetingTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

export type Meeting = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  meetingLink: string | null;
  meetingUrl?: string | null;
  meetingProvider: MeetingProvider | null;
  room: string | null;
  address: string | null;
  mapUrl: string | null;
  mode: MeetingMode;
  organizerId: string;
  projectId: string | null;
  teamId: string | null;
  status: MeetingStatus;
  notes: string | null;
  discussion: string | null;
  decisions: string | null;
  remindMinutes: number[];
  recurrence: MeetingRecurrence;
  recurrenceUntil: string | null;
  recurrenceWeekdays: number[];
  durationMinutes: number;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  occurrenceStart?: string;
  organizer: Person;
  project: { id: string; name: string; status: string } | null;
  team: { id: string; name: string; icon: string | null } | null;
  participants: MeetingParticipant[];
  agenda: MeetingAgendaItem[];
  actionItems: MeetingActionItem[];
  linkedTasks: LinkedMeetingTask[];
};

export type MeetingParticipantDraft = {
  userId: string;
  kind: MeetingParticipantKind;
};

export type MeetingFormValues = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: MeetingMode;
  meetingProvider: MeetingProvider | "";
  meetingUrl: string;
  location: string;
  room: string;
  address: string;
  mapUrl: string;
  projectId: string;
  teamId: string;
  notes: string;
  participants: MeetingParticipantDraft[];
  agendaItems: string[];
  remindMinutes: number[];
  recurrence: MeetingRecurrence;
  recurrenceUntil: string;
  recurrenceWeekdays: number[];
};

export type MeetingWriteInput = {
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  mode?: MeetingMode;
  meetingProvider?: MeetingProvider | null;
  meetingUrl?: string | null;
  meetingLink?: string | null;
  location?: string | null;
  room?: string | null;
  address?: string | null;
  mapUrl?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  notes?: string | null;
  discussion?: string | null;
  decisions?: string | null;
  participantIds?: string[];
  participants?: MeetingParticipantDraft[];
  agenda?: string[];
  remindMinutes?: number[];
  remindMinutesBefore?: number;
  recurrence?: MeetingRecurrence;
  recurrenceUntil?: string | null;
  recurrenceWeekdays?: number[];
};

export type MeetingPatchInput = Partial<MeetingWriteInput>;

export type MeetingListQuery = {
  range?: MeetingRange;
  projectId?: string;
  teamId?: string;
  status?: MeetingStatus;
};

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  startAt: string;
  endAt?: string | null;
  href: string;
  status?: string;
  projectId?: string | null;
  teamId?: string | null;
  userIds: string[];
};

export type CalendarResponse = {
  from: string;
  to: string;
  events: CalendarEvent[];
};

export type CalendarQuery = {
  from?: string;
  to?: string;
  teamId?: string;
  projectId?: string;
  userId?: string;
  types?: CalendarEventType[];
};

export type ConvertActionItemInput = {
  title?: string;
  assigneeId?: string;
  projectId?: string;
  dueDate?: string;
  priority?: Priority;
};

export type CreateActionItemInput = {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
};

export const PROVIDER_LABELS: Record<MeetingProvider, string> = {
  GOOGLE_MEET: "Google Meet",
  ZOOM: "Zoom",
  MICROSOFT_TEAMS: "Microsoft Teams",
  CUSTOM: "Custom Link",
};

export const RANGE_LABELS: Record<MeetingRange, string> = {
  upcoming: "Upcoming",
  today: "Today",
  week: "This Week",
  past: "Past",
};

export const REMIND_LABELS: Record<number, string> = {
  15: "15 minutes before",
  30: "30 minutes before",
  60: "1 hour before",
  1440: "1 day before",
};

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export { PRIORITIES };
