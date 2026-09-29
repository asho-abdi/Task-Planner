"use client";

import Link from "next/link";
import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { activityHref } from "@/features/chat/types";
import { useActivity } from "@/features/chat/hooks";
import { formatRelativeTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function ActivityPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const activity = useActivity(workspaceId);

  return (
    <PageShell>
      <PageHeader
        title="Activity"
        description="What the workspace has been doing — tasks, files, meetings, and comments."
      />
      {activity.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : activity.isError ? (
        <p className="text-sm text-destructive">{activity.error.message}</p>
      ) : !(activity.data ?? []).length ? (
        <EmptyState title="No activity yet" description="Work in this workspace will show up here." />
      ) : (
        <Surface className="space-y-0 p-0">
          <ol className="divide-y divide-border">
            {(activity.data ?? []).map((item) => {
              const href = activityHref(item.entityType, item.entityId);
              const actor = item.actor?.name ?? "Someone";
              const content = (
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{actor}</span> {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.entityType ?? "workspace"} · {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={item.id}>
                  {href ? (
                    <Link href={href} className="block hover:bg-secondary">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ol>
        </Surface>
      )}
    </PageShell>
  );
}
