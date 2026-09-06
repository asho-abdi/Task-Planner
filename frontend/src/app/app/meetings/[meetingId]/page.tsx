"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell, Surface } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeams } from "@/features/collaboration/hooks";
import { useProjects } from "@/features/projects/hooks";
import {
  useCancelMeeting,
  useCompleteMeeting,
  useMeeting,
  useUpdateMeeting,
} from "@/features/meetings/hooks";
import {
  meetingToFormValues,
  MeetingForm,
  toMeetingWriteInput,
} from "@/features/meetings/meeting-form";
import {
  MeetingActionItems,
  MeetingAgenda,
  MeetingFiles,
  MeetingLinkedTasks,
  MeetingMeta,
  MeetingNotes,
  MeetingParticipants,
  joinMeetingUrl,
} from "@/features/meetings/meeting-ui";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useCurrentWorkspace,
  useWorkspaceMembers,
} from "@/features/workspaces/hooks";
import { useWorkspaceStore } from "@/store/workspace-store";
import { AiExtractCard } from "@/features/ai/ui";
import { REMIND_LABELS } from "@/features/meetings/types";

export default function MeetingDetailPage() {
  const params = useParams<{ meetingId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const meeting = useMeeting(workspaceId, params.meetingId);
  const workspace = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const projects = useProjects(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const teams = useTeams(workspaceId);
  const updateMeeting = useUpdateMeeting(params.meetingId);
  const cancelMeeting = useCancelMeeting();
  const completeMeeting = useCompleteMeeting();
  const [editing, setEditing] = useState(false);
  const isAdmin =
    workspace?.role === "OWNER" || workspace?.role === "ADMIN";
  const canWrite = Boolean(workspace && workspace.role !== "VIEWER");

  if (meeting.isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (!meeting.data) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Meeting not found.</p>
      </PageShell>
    );
  }

  const item = meeting.data;
  const locked = item.status === "CANCELLED";
  const joinUrl = joinMeetingUrl(item.meetingUrl ?? item.meetingLink);
  const userId = currentUser.data?.id;
  const canManage =
    canWrite &&
    !locked &&
    (isAdmin || userId === item.organizerId);
  const canTakeNotes =
    canWrite &&
    !locked &&
    (canManage ||
      item.participants.some(
        (person) => person.userId === userId || person.id === userId,
      ));

  return (
    <PageShell>
      <PageHeader
        title={item.title}
        backHref="/app/meetings"
        backLabel="Back to meetings"
        description={`${item.organizer.name} · ${item.team?.name ?? "No team"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={item.status} />
            {joinUrl && item.mode === "ONLINE" ? (
              <Button asChild>
                <a href={joinUrl} target="_blank" rel="noreferrer">
                  Join Meeting
                </a>
              </Button>
            ) : null}
            {canManage && item.status !== "COMPLETED" ? (
              <Button
                variant="outline"
                onClick={() =>
                  void completeMeeting.mutateAsync(item.id).catch(() => undefined)
                }
                disabled={completeMeeting.isPending}
              >
                Complete
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="destructive"
                onClick={() =>
                  void cancelMeeting.mutateAsync(item.id).catch(() => undefined)
                }
                disabled={cancelMeeting.isPending}
              >
                Cancel meeting
              </Button>
            ) : null}
          </div>
        }
      />
      <MeetingMeta meeting={item} />
      {item.recurrence !== "NONE" || (item.remindMinutes ?? []).length ? (
        <p className="text-sm text-muted-foreground">
          {item.recurrence !== "NONE"
            ? `Repeats ${item.recurrence.toLowerCase()}`
            : "Does not repeat"}
          {(item.remindMinutes ?? []).length
            ? ` · Reminders: ${item.remindMinutes
                .map((minutes) => REMIND_LABELS[minutes] ?? `${minutes} min`)
                .join(", ")}`
            : ""}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="space-y-4">
          <MeetingParticipants
            meeting={item}
            userId={userId}
            canWrite={!locked}
          />
          <MeetingAgenda meeting={item} canWrite={canManage} />
          <MeetingNotes key={item.id} meeting={item} canWrite={canTakeNotes} />
        </div>
        <div className="space-y-4">
          <MeetingActionItems meeting={item} canWrite={canManage} />
          <MeetingLinkedTasks meeting={item} />
          <MeetingFiles meeting={item} canWrite={canManage} />
        </div>
      </div>
      {canManage ? (
        <Surface>
          {editing ? (
            <MeetingForm
              key={item.updatedAt}
              initial={meetingToFormValues(item)}
              projects={projects}
              members={members}
              teams={teams}
              submitting={updateMeeting.isPending}
              submitLabel="Save"
              error={updateMeeting.error?.message}
              extraActions={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Close
                </Button>
              }
              onSubmit={async (values) => {
                try {
                  await updateMeeting.mutateAsync(toMeetingWriteInput(values));
                  setEditing(false);
                } catch {
                  // Error is shown on the form via updateMeeting.error
                }
              }}
            />
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit meeting
            </Button>
          )}
        </Surface>
      ) : locked ? (
        <p className="text-sm text-muted-foreground">This meeting is cancelled.</p>
      ) : null}
      <AiExtractCard
        meetingId={item.id}
        projectId={item.projectId ?? undefined}
        defaultText={[item.discussion, item.notes, item.description]
          .filter(Boolean)
          .join("\n")}
        canWrite={canManage}
      />
    </PageShell>
  );
}
