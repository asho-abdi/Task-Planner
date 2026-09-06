"use client";

import Link from "next/link";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
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
        description="Schedule online or in-person meetings, capture notes, and turn action items into tasks."
        actions={
          canWrite ? (
            <Button onClick={() => setOpenCreateDialog("meeting")}>
              New meeting
            </Button>
          ) : null
        }
      />
      <MeetingRangeTabs value={range} onChange={setRange} />
      {meetings.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : meetings.isError ? (
        <p className="text-sm text-destructive">{meetings.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          title={
            range === "past" ? "No past meetings" : "No meetings in this view"
          }
          description="Create a meeting to put it on the team calendar."
          action={
            canWrite ? (
              <Button onClick={() => setOpenCreateDialog("meeting")}>
                New meeting
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {items.map((meeting) => (
            <MeetingCard
              key={`${meeting.id}-${meeting.startAt}`}
              meeting={meeting}
            />
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Open the{" "}
        <Link href="/app/calendar" className="text-primary hover:underline">
          team calendar
        </Link>{" "}
        to see meetings together with tasks, deadlines, and milestones.
      </p>
    </PageShell>
  );
}
