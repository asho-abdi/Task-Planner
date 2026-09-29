"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  BellOff,
  CalendarClock,
  CalendarDays,
  CalendarX,
  CheckCheck,
  CheckCircle2,
  Check,
  FolderKanban,
  MessageSquare,
  Share2,
  Undo2,
  Upload,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  SegmentedControl,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { notificationHref } from "@/features/collaboration/api";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/collaboration/hooks";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

type Tone = "primary" | "info" | "success" | "warning" | "danger" | "default";

const TYPE_META: Record<string, { icon: LucideIcon; tone: Tone }> = {
  MENTION: { icon: AtSign, tone: "primary" },
  COMMENT_ADDED: { icon: MessageSquare, tone: "info" },
  TASK_ASSIGNED: { icon: UserPlus, tone: "primary" },
  TASK_SHARED: { icon: Share2, tone: "info" },
  TASK_SUBMITTED: { icon: Upload, tone: "info" },
  TASK_APPROVED: { icon: CheckCircle2, tone: "success" },
  TASK_RETURNED: { icon: Undo2, tone: "warning" },
  TASK_SUBMISSION_RETURNED: { icon: Undo2, tone: "warning" },
  PROJECT_ASSIGNED: { icon: FolderKanban, tone: "primary" },
  PROJECT_COMPLETED: { icon: CheckCircle2, tone: "success" },
  PROJECT_CONFIRMED: { icon: CheckCircle2, tone: "success" },
  PROJECT_RETURNED: { icon: Undo2, tone: "warning" },
  MEETING_INVITE: { icon: CalendarDays, tone: "info" },
  MEETING_REMINDER: { icon: CalendarClock, tone: "warning" },
  MEETING_CANCELLED: { icon: CalendarX, tone: "danger" },
  TEAM_INVITE: { icon: Users, tone: "primary" },
  WORKSPACE_INVITE: { icon: Users, tone: "primary" },
  AUTOMATION: { icon: Zap, tone: "default" },
};

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  default: "bg-muted text-muted-foreground",
};

function NotificationsSkeleton() {
  return (
    <ListPanel>
      <div role="status" aria-label="Loading notifications" className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </ListPanel>
  );
}

export default function NotificationsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const notifications = useNotifications(workspaceId);
  const markAll = useMarkAllRead();
  const markRead = useMarkNotificationRead();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadCount = notifications.data?.unreadCount ?? 0;
  const items = (notifications.data?.items ?? []).filter(
    (item) => filter === "all" || !item.isRead,
  );

  return (
    <PageShell width="narrow">
      <PageHeader
        icon={Bell}
        title="Notifications"
        description="Mentions, assignments, and reminders."
        meta={
          notifications.data ? (
            <span>
              <span className="font-medium text-foreground tabular">{unreadCount}</span>{" "}
              unread
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Filter notifications"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            {
              value: "unread",
              label: unreadCount ? `Unread (${unreadCount})` : "Unread",
            },
          ]}
        />
        {unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            loading={markAll.isPending}
            onClick={() =>
              markAll.mutate(undefined, {
                onSuccess: () => toast.success("All notifications marked as read"),
              })
            }
          >
            <CheckCheck />
            Mark all read
          </Button>
        ) : null}
      </div>

      {notifications.isLoading ? (
        <NotificationsSkeleton />
      ) : notifications.isError ? (
        <ErrorState
          title="Couldn't load notifications"
          description={notifications.error.message}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void notifications.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <ListPanel>
          <EmptyState
            icon={filter === "unread" ? CheckCheck : BellOff}
            title={filter === "unread" ? "No unread notifications" : "You're all caught up"}
            description={
              filter === "unread"
                ? "Everything has been read. Nice work."
                : "Mentions, assignments and reminders will land here."
            }
            action={
              filter === "unread" && (notifications.data?.items.length ?? 0) > 0 ? (
                <Button size="sm" variant="outline" onClick={() => setFilter("all")}>
                  View all notifications
                </Button>
              ) : undefined
            }
          />
        </ListPanel>
      ) : (
        <ListPanel>
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const meta = TYPE_META[item.type] ?? { icon: Bell, tone: "default" as Tone };
              const Icon = meta.icon;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "group relative flex items-start transition-colors duration-150 hover:bg-muted/60",
                    !item.isRead && "bg-primary-soft/30",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                    onClick={() => {
                      if (!item.isRead) void markRead.mutate(item.id);
                      router.push(notificationHref(item));
                    }}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        TONE_CLASS[meta.tone],
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "min-w-0 line-clamp-2 text-base sm:line-clamp-1",
                            item.isRead
                              ? "text-muted-foreground"
                              : "font-medium text-foreground",
                          )}
                        >
                          {item.title}
                        </span>
                        <time
                          dateTime={item.createdAt}
                          title={formatDateTime(item.createdAt)}
                          className="shrink-0 text-xs text-subtle-foreground tabular"
                        >
                          {formatRelativeTime(item.createdAt)}
                        </time>
                      </span>
                      {item.message ? (
                        <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                          {item.message}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <div className="flex w-10 shrink-0 items-center justify-center self-stretch pr-2 sm:pr-3">
                    {!item.isRead ? (
                      <Tooltip content="Mark as read">
                        <button
                          type="button"
                          aria-label={`Mark "${item.title}" as read`}
                          disabled={markRead.isPending && markRead.variables === item.id}
                          onClick={() =>
                            markRead.mutate(item.id, {
                              onSuccess: () => toast.success("Marked as read"),
                            })
                          }
                          className="relative flex size-7 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span
                            aria-hidden
                            className="size-2 rounded-full bg-primary transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0"
                          />
                          <Check
                            aria-hidden
                            className="absolute size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                          />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </ListPanel>
      )}
    </PageShell>
  );
}
