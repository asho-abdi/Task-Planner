"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as meetingsApi from "@/features/meetings/api";
import { insightKeys } from "@/features/insights/hooks";
import { taskKeys } from "@/features/tasks/hooks";
import type {
  CalendarQuery,
  ConvertActionItemInput,
  CreateActionItemInput,
  MeetingListQuery,
  MeetingPatchInput,
  MeetingResponse,
  MeetingWriteInput,
} from "@/features/meetings/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export const meetingKeys = {
  all: (workspaceId: string) => ["meetings", workspaceId] as const,
  list: (workspaceId: string, query: MeetingListQuery = {}) =>
    [...meetingKeys.all(workspaceId), "list", query] as const,
  detail: (workspaceId: string, meetingId: string) =>
    [...meetingKeys.all(workspaceId), "detail", meetingId] as const,
  calendar: (workspaceId: string, query: CalendarQuery) =>
    [...meetingKeys.all(workspaceId), "calendar", query] as const,
};

export function useMeetings(
  workspaceId: string | null,
  query: MeetingListQuery = {},
  enabled = true,
) {
  return useQuery({
    queryKey: meetingKeys.list(workspaceId ?? "none", query),
    queryFn: () => meetingsApi.listMeetings(query),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 60_000,
  });
}

export function useMeeting(workspaceId: string | null, meetingId: string) {
  return useQuery({
    queryKey: meetingKeys.detail(workspaceId ?? "none", meetingId),
    queryFn: () => meetingsApi.getMeeting(meetingId),
    enabled: Boolean(workspaceId) && Boolean(meetingId),
    staleTime: 60_000,
  });
}

export function useCalendar(workspaceId: string | null, query: CalendarQuery) {
  return useQuery({
    queryKey: meetingKeys.calendar(workspaceId ?? "none", query),
    queryFn: () => meetingsApi.getCalendar(query),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

function useInvalidateMeetings() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return () => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({ queryKey: meetingKeys.all(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: insightKeys.all(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: taskKeys.all(workspaceId) });
  };
}

export function useCreateMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: meetingsApi.createMeeting,
    onSuccess: invalidate,
  });
}

export function useUpdateMeeting(meetingId: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: MeetingPatchInput) =>
      meetingsApi.updateMeeting(meetingId, input),
    onSuccess: invalidate,
  });
}

export function useCancelMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: meetingsApi.cancelMeeting,
    onSuccess: invalidate,
  });
}

export function useCompleteMeeting() {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: meetingsApi.completeMeeting,
    onSuccess: invalidate,
  });
}

export function useRsvpMeeting(meetingId: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (response: MeetingResponse) =>
      meetingsApi.rsvpMeeting(meetingId, response),
    onSuccess: invalidate,
  });
}

export function useUpdateAgenda(meetingId: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (agenda: string[]) => meetingsApi.updateAgenda(meetingId, agenda),
    onSuccess: invalidate,
  });
}

export function useCreateActionItem(meetingId: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: (input: CreateActionItemInput) =>
      meetingsApi.createActionItem(meetingId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateActionItem(meetingId: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: string;
      input: Partial<CreateActionItemInput> & { done?: boolean };
    }) => meetingsApi.updateActionItem(meetingId, itemId, input),
    onSuccess: invalidate,
  });
}

export function useConvertActionItem(meetingId: string) {
  const invalidate = useInvalidateMeetings();
  return useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: string;
      input: ConvertActionItemInput;
    }) => meetingsApi.convertActionItem(meetingId, itemId, input),
    onSuccess: invalidate,
  });
}

export type { MeetingWriteInput };
