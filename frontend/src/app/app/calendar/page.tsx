"use client";

import Link from "next/link";
import { CalendarDays, Video } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { TeamCalendar } from "@/features/meetings/meeting-ui";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function CalendarPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  return (
    <PageShell width="wide">
      <PageHeader
        icon={CalendarDays}
        title="Calendar"
        description="Meetings, tasks, deadlines and milestones in one view."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/app/meetings">
              <Video />
              Meetings
            </Link>
          </Button>
        }
      />
      <TeamCalendar workspaceId={workspaceId} />
    </PageShell>
  );
}
