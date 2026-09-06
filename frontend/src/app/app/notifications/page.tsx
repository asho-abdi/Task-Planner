"use client";

import { useState } from "react";
import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  notificationHref,
} from "@/features/collaboration/api";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/collaboration/hooks";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function NotificationsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const notifications = useNotifications(workspaceId);
  const markAll = useMarkAllRead();
  const markRead = useMarkNotificationRead();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const items = (notifications.data?.items ?? []).filter(
    (item) => filter === "all" || !item.isRead,
  );

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description="Mentions, assignments, comments, and meeting reminders for this workspace."
        actions={
          (notifications.data?.unreadCount ?? 0) > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void markAll.mutate()}
            >
              Mark all as read
            </Button>
          ) : null
        }
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={filter === "unread" ? "default" : "outline"}
          onClick={() => setFilter("unread")}
        >
          Unread
        </Button>
      </div>
      {notifications.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title="You're all caught up." />
      ) : (
        <Surface className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "block w-full rounded-xl px-3 py-2.5 text-left hover:bg-secondary",
                !item.isRead && "bg-indigo-50/60",
              )}
              onClick={() => {
                if (!item.isRead) void markRead.mutate(item.id);
                router.push(notificationHref(item));
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </Surface>
      )}
    </PageShell>
  );
}
