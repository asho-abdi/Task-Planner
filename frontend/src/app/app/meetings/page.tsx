"use client";

import Link from "next/link";
import { EmptyState, ListPanel, PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetings } from "@/features/meetings/hooks";
import {
  MeetingCard,
  MeetingRangeTabs,
} from "@/features/meetings/meeting-ui";
import type { MeetingRange } from "@/features/meetings/types";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useState } from "react";

export default function MeetingsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const [range, setRange] = useState<MeetingRange>("upcoming");
  const meetings = useMeetings(workspaceId, { range });
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const canWrite = workspace && workspace.role !== "VIEWER";
  const items = meetings.data ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Meetings"
        description="Schedule and notes for this workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MeetingRangeTabs value={range} onChange={setRange} />
            {canWrite ? (
              <Button size="sm" onClick={() => setOpenCreateDialog("meeting")}>
                New meeting
              </Button>
            ) : null}
          </div>
        }
      />
      {meetings.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : meetings.isError ? (
        <p className="text-sm text-destructive">{meetings.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          title={
            range === "past" ? "No past meetings" : "No meetings in this view"
          }
          description="Create a meeting to put it on the calendar."
          action={
            canWrite ? (
              <Button size="sm" onClick={() => setOpenCreateDialog("meeting")}>
                New meeting
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ListPanel className="divide-y divide-[#E5E7EB]">
          {items.map((meeting) => (
            <MeetingCard
              key={`${meeting.id}-${meeting.startAt}`}
              meeting={meeting}
            />
          ))}
        </ListPanel>
      )}
      <p className="text-[14px] font-medium text-[#64748B]">
        See everything together on the{" "}
        <Link href="/app/calendar" className="font-semibold text-primary hover:underline">
          calendar
        </Link>
        .
      </p>
    </PageShell>
  );
}
