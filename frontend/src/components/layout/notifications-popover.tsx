"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { notificationHref } from "@/features/collaboration/api";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/collaboration/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SkeletonList } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, formatRelativeTime } from "@/lib/utils";

export function NotificationsPopover({ workspaceId }: { workspaceId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications(workspaceId);
  const markAllRead = useMarkAllRead();
  const markRead = useMarkNotificationRead();
  const items = notifications.data?.items ?? [];
  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Notifications">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
            }
            className="relative"
          >
            <Bell />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex size-2 items-center justify-center">
                <span className="absolute size-2 animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
                <span className="relative size-2 rounded-full bg-primary ring-2 ring-background" />
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold">Notifications</p>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-primary-soft px-1.5 text-2xs font-semibold leading-4 text-primary-soft-foreground tabular">
                {unreadCount}
              </span>
            ) : null}
          </div>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck />
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-[min(60vh,380px)] overflow-y-auto">
          {notifications.isLoading ? (
            <SkeletonList rows={3} />
          ) : items.length === 0 ? (
            <EmptyState
              compact
              icon={Bell}
              title="You're all caught up"
              description="New mentions, assignments and reviews will show up here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "relative flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    )}
                    onClick={() => {
                      setOpen(false);
                      if (!item.isRead) markRead.mutate(item.id);
                      router.push(notificationHref(item));
                    }}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        item.isRead ? "bg-transparent" : "bg-primary",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-base",
                          item.isRead ? "text-muted-foreground" : "font-medium text-foreground",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                        {item.message}
                      </span>
                      <span className="mt-1 block text-2xs text-subtle-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/app/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
