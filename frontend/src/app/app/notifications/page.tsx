"use client";

import { useState } from "react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  SegmentedControl,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationHref } from "@/features/collaboration/api";
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
        description="Mentions, assignments, and reminders."
        actions={
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "unread", label: "Unread" },
              ]}
            />
            {(notifications.data?.unreadCount ?? 0) > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markAll.mutate()}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />
      {notifications.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : notifications.isError ? (
        <p className="text-sm text-destructive">{notifications.error.message}</p>
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === "unread" ? "No unread notifications" : "You're all caught up"}
        />
      ) : (
        <ListPanel className="divide-y divide-border">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "relative block w-full px-4 py-3 text-left hover:bg-muted",
              )}
              onClick={() => {
                if (!item.isRead) void markRead.mutate(item.id);
                router.push(notificationHref(item));
              }}
            >
              {!item.isRead ? (
                <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary" />
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[13px] text-foreground",
                      !item.isRead && "font-medium",
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{item.message}</p>
                </div>
                <p className="shrink-0 text-[12px] text-subtle-foreground">
                  {formatRelativeTime(item.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </ListPanel>
      )}
    </PageShell>
  );
}
