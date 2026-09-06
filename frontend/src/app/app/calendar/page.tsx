"use client";

import { PageHeader, PageShell } from "@/components/page-header";
import { TeamCalendar } from "@/features/meetings/meeting-ui";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function CalendarPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  return (
    <PageShell>
      <PageHeader
        title="Team calendar"
        description="Meetings, tasks, deadlines, and milestones for the current workspace. Filters stay on this page; switch workspaces from the sidebar."
      />
      <TeamCalendar workspaceId={workspaceId} />
    </PageShell>
  );
}
