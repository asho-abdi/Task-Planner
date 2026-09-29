"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Ban,
  Bell,
  CalendarX,
  CheckCircle2,
  Clock,
  Pencil,
  Repeat,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
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
  formatMeetingTime,
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

function DetailSkeleton() {
  return (
    <PageShell width="wide">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </PageShell>
  );
}

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
    return <DetailSkeleton />;
  }

  if (!meeting.data) {
    return (
      <PageShell>
        <PageHeader
          title="Meeting"
          breadcrumbs={[
            { label: "Meetings", href: "/app/meetings" },
            { label: "Not found" },
          ]}
        />
        <Surface>
          <EmptyState
            icon={CalendarX}
            title="Meeting not found"
            description={
              meeting.isError
                ? meeting.error.message
                : "It may have been deleted or you no longer have access."
            }
            action={
              <div className="flex gap-2">
                {meeting.isError ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void meeting.refetch()}
                  >
                    Retry
                  </Button>
                ) : null}
                <Button asChild size="sm">
                  <Link href="/app/meetings">Back to meetings</Link>
                </Button>
              </div>
            }
          />
        </Surface>
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
  const reminders = item.remindMinutes ?? [];
  const startDate = new Date(item.startAt);

  return (
    <PageShell width="wide">
      <PageHeader
        title={item.title}
        breadcrumbs={[
          { label: "Meetings", href: "/app/meetings" },
          { label: item.title },
        ]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={item.organizer.name} size="xs" />
              Organized by{" "}
              <span className="font-medium text-foreground">
                {item.organizer.name}
              </span>
            </span>
            {item.team ? (
              <span className="text-subtle-foreground">· {item.team.name}</span>
            ) : null}
          </span>
        }
        meta={
          <>
            <StatusBadge value={item.status} />
            <span className="inline-flex items-center gap-1 tabular">
              <Clock className="size-3.5" />
              {startDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {" · "}
              {formatMeetingTime(item)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3.5" />
              {item.recurrence !== "NONE"
                ? `Repeats ${item.recurrence.toLowerCase()}`
                : "Does not repeat"}
            </span>
            {reminders.length ? (
              <span className="inline-flex items-center gap-1">
                <Bell className="size-3.5" />
                {reminders
                  .map((minutes) => REMIND_LABELS[minutes] ?? `${minutes} min`)
                  .join(", ")}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            {joinUrl && item.mode === "ONLINE" ? (
              <Button asChild>
                <a href={joinUrl} target="_blank" rel="noreferrer">
                  <Video />
                  Join Meeting
                </a>
              </Button>
            ) : null}
            {canManage && !editing ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
            {canManage && item.status !== "COMPLETED" ? (
              <Button
                variant="outline"
                loading={completeMeeting.isPending}
                onClick={() =>
                  void completeMeeting
                    .mutateAsync(item.id)
                    .then(() => toast.success("Meeting marked as complete"))
                    .catch(() => undefined)
                }
              >
                <CheckCircle2 />
                Complete
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="destructive"
                loading={cancelMeeting.isPending}
                onClick={() =>
                  void cancelMeeting
                    .mutateAsync(item.id)
                    .then(() => toast.success("Meeting cancelled"))
                    .catch(() => undefined)
                }
              >
                <Ban />
                Cancel meeting
              </Button>
            ) : null}
          </>
        }
      />

      {locked ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Ban className="size-4 shrink-0" />
          This meeting is cancelled. Notes and agenda are read only.
        </div>
      ) : null}

      {canManage && editing ? (
        <Surface className="animate-fade-in">
          <div className="mb-5">
            <h2 className="text-md font-semibold tracking-[-0.01em] text-foreground">
              Edit meeting
            </h2>
            <p className="text-sm text-muted-foreground">
              Changes are sent to participants when you save.
            </p>
          </div>
          <MeetingForm
            key={item.updatedAt}
            initial={meetingToFormValues(item)}
            projects={projects}
            members={members}
            teams={teams}
            submitting={updateMeeting.isPending}
            submitLabel="Save changes"
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
                toast.success("Meeting updated");
                setEditing(false);
              } catch {
                // Error is shown on the form via updateMeeting.error
              }
            }}
          />
        </Surface>
      ) : null}

      <MeetingMeta meeting={item} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {item.description ? (
            <Surface>
              <h2 className="mb-2 text-md font-semibold tracking-[-0.01em] text-foreground">
                About
              </h2>
              <p className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </Surface>
          ) : null}
          <MeetingAgenda meeting={item} canWrite={canManage} />
          <MeetingNotes key={item.id} meeting={item} canWrite={canTakeNotes} />
          <MeetingActionItems meeting={item} canWrite={canManage} />
          <AiExtractCard
            meetingId={item.id}
            projectId={item.projectId ?? undefined}
            defaultText={[item.discussion, item.notes, item.description]
              .filter(Boolean)
              .join("\n")}
            canWrite={canManage}
          />
        </div>
        <aside className="min-w-0 space-y-6">
          <MeetingParticipants
            meeting={item}
            userId={userId}
            canWrite={!locked}
          />
          <MeetingLinkedTasks meeting={item} />
          <MeetingFiles meeting={item} canWrite={canManage} />
        </aside>
      </div>
    </PageShell>
  );
}
