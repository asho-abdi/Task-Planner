"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, Video } from "lucide-react";
import { EmptyState, ListPanel, PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetings } from "@/features/meetings/hooks";
import {
  MeetingCard,
  MeetingRangeTabs,
} from "@/features/meetings/meeting-ui";
import type { Meeting, MeetingRange } from "@/features/meetings/types";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayHeading(date: Date) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
  const key = dayKey(date);
  if (key === dayKey(today)) return { primary: "Today", secondary: label };
  if (key === dayKey(tomorrow)) return { primary: "Tomorrow", secondary: label };
  if (key === dayKey(yesterday)) return { primary: "Yesterday", secondary: label };
  return { primary: label, secondary: null };
}

/** Group consecutive meetings (already ordered by the API) by calendar day. */
function groupByDay(items: Meeting[]) {
  const groups: Array<{ key: string; date: Date; meetings: Meeting[] }> = [];
  for (const meeting of items) {
    const date = new Date(meeting.startAt);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.meetings.push(meeting);
    else groups.push({ key, date, meetings: [meeting] });
  }
  return groups;
}

function MeetingsSkeleton() {
  return (
    <div className="space-y-6">
      {[3, 2].map((rows, group) => (
        <div key={group} className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <ListPanel className="divide-y divide-border">
            {Array.from({ length: rows }, (_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
              </div>
            ))}
          </ListPanel>
        </div>
      ))}
    </div>
  );
}

export default function MeetingsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const [range, setRange] = useState<MeetingRange>("upcoming");
  const meetings = useMeetings(workspaceId, { range });
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const canWrite = workspace && workspace.role !== "VIEWER";
  const items = useMemo(() => meetings.data ?? [], [meetings.data]);
  const groups = useMemo(() => groupByDay(items), [items]);
  const onlineCount = items.filter((meeting) => meeting.mode === "ONLINE").length;

  const scheduleButton = canWrite ? (
    <Button size="sm" onClick={() => setOpenCreateDialog("meeting")}>
      <CalendarPlus />
      Schedule meeting
    </Button>
  ) : null;

  return (
    <PageShell>
      <PageHeader
        icon={Video}
        title="Meetings"
        description="Schedule, run and follow up on meetings in this workspace."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/calendar">
                <CalendarDays />
                Calendar
              </Link>
            </Button>
            {scheduleButton}
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <MeetingRangeTabs value={range} onChange={setRange} />
        </div>
        {!meetings.isLoading && items.length ? (
          <p className="text-sm text-muted-foreground tabular">
            {items.length} {items.length === 1 ? "meeting" : "meetings"}
            {onlineCount ? ` · ${onlineCount} online` : ""}
          </p>
        ) : null}
      </div>
      {meetings.isLoading ? (
        <MeetingsSkeleton />
      ) : meetings.isError ? (
        <ErrorState
          title="Couldn't load meetings"
          description={meetings.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void meetings.refetch()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <ListPanel>
          <EmptyState
            icon={CalendarDays}
            title={
              range === "past" ? "No past meetings" : "No meetings in this view"
            }
            description="Schedule a meeting to put it on the team calendar."
            action={scheduleButton ?? undefined}
          />
        </ListPanel>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const heading = dayHeading(group.date);
            return (
              <section key={group.key} className="space-y-2">
                <h2 className="flex items-baseline gap-2 px-1 text-sm">
                  <span className="font-semibold text-foreground">
                    {heading.primary}
                  </span>
                  {heading.secondary ? (
                    <span className="text-muted-foreground">{heading.secondary}</span>
                  ) : null}
                  <span className="text-subtle-foreground tabular">
                    · {group.meetings.length}
                  </span>
                </h2>
                <ListPanel className="divide-y divide-border">
                  {group.meetings.map((meeting) => (
                    <MeetingCard
                      key={`${meeting.id}-${meeting.startAt}`}
                      meeting={meeting}
                    />
                  ))}
                </ListPanel>
              </section>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
