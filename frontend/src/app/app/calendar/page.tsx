"use client";

import { PageHeader, PageShell } from "@/components/page-header";
import { TeamCalendar } from "@/features/meetings/meeting-ui";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function CalendarPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        description="Meetings, tasks, and milestones."
      />
      <TeamCalendar workspaceId={workspaceId} />
    </PageShell>
  );
}
