import { apiRequest } from "@/lib/api-client";
import type {
  CalendarQuery,
  CalendarResponse,
  ConvertActionItemInput,
  CreateActionItemInput,
  Meeting,
  MeetingListQuery,
  MeetingPatchInput,
  MeetingResponse,
  MeetingWriteInput,
} from "@/features/meetings/types";

function toSearch(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function listMeetings(query: MeetingListQuery = {}) {
  return apiRequest<Meeting[]>(
    `/meetings${toSearch({
      range: query.range,
      projectId: query.projectId,
      teamId: query.teamId,
      status: query.status,
    })}`,
  );
}

export function getMeeting(meetingId: string) {
  return apiRequest<Meeting>(`/meetings/${meetingId}`);
}

export function createMeeting(input: MeetingWriteInput) {
  return apiRequest<Meeting>("/meetings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMeeting(meetingId: string, input: MeetingPatchInput) {
  return apiRequest<Meeting>(`/meetings/${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function cancelMeeting(meetingId: string) {
  return apiRequest<Meeting>(`/meetings/${meetingId}/cancel`, { method: "POST" });
}

export function completeMeeting(meetingId: string) {
  return apiRequest<Meeting>(`/meetings/${meetingId}/complete`, {
    method: "POST",
  });
}

export function rsvpMeeting(meetingId: string, response: MeetingResponse) {
  return apiRequest<Meeting>(`/meetings/${meetingId}/rsvp`, {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

export function updateAgenda(meetingId: string, agenda: string[]) {
  return apiRequest<Meeting>(`/meetings/${meetingId}/agenda`, {
    method: "PATCH",
    body: JSON.stringify({ agenda }),
  });
}

export function createActionItem(
  meetingId: string,
  input: CreateActionItemInput,
) {
  return apiRequest<Meeting>(`/meetings/${meetingId}/action-items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateActionItem(
  meetingId: string,
  itemId: string,
  input: Partial<CreateActionItemInput> & { done?: boolean },
) {
  return apiRequest<Meeting>(
    `/meetings/${meetingId}/action-items/${itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function convertActionItem(
  meetingId: string,
  itemId: string,
  input: ConvertActionItemInput,
) {
  return apiRequest<Meeting>(
    `/meetings/${meetingId}/action-items/${itemId}/task`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function getCalendar(query: CalendarQuery = {}) {
  return apiRequest<CalendarResponse>(
    `/calendar${toSearch({
      from: query.from,
      to: query.to,
      teamId: query.teamId,
      projectId: query.projectId,
      userId: query.userId,
      types: query.types ? query.types.join(",") : undefined,
    })}`,
  );
}
