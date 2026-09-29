"use client";

import Link from "next/link";
import {
  Activity as ActivityIcon,
  CalendarDays,
  CheckSquare,
  FileText,
  Flag,
  FolderKanban,
  ListTodo,
  Mail,
  MessageSquare,
  Paperclip,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { activityHref } from "@/features/chat/types";
import type { ActivityEvent } from "@/features/chat/types";
import { useActivity } from "@/features/chat/hooks";
import { formatDateTime, formatRelativeTime, localDateYmd } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const ENTITY_META: Record<string, { icon: LucideIcon; label: string }> = {
  task: { icon: CheckSquare, label: "Task" },
  project: { icon: FolderKanban, label: "Project" },
  meeting: { icon: CalendarDays, label: "Meeting" },
  file: { icon: Paperclip, label: "File" },
  conversation: { icon: MessageSquare, label: "Chat" },
  comment: { icon: MessageSquare, label: "Comment" },
  team: { icon: Users, label: "Team" },
  invitation: { icon: Mail, label: "Invitation" },
  goal: { icon: Target, label: "Goal" },
  todo: { icon: ListTodo, label: "To-do" },
  page: { icon: FileText, label: "Page" },
  milestone: { icon: Flag, label: "Milestone" },
};

function metaFor(entityType: string | null) {
  return (
    (entityType && ENTITY_META[entityType]) || {
      icon: ActivityIcon,
      label: entityType ? entityType.replaceAll("_", " ") : "Workspace",
    }
  );
}

function dayLabel(ymd: string) {
  const today = localDateYmd();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (ymd === today) return "Today";
  if (ymd === localDateYmd(yesterdayDate)) return "Yesterday";
  const date = new Date(`${ymd}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function groupByDay(items: ActivityEvent[]) {
  const groups: Array<{ day: string; items: ActivityEvent[] }> = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const date = new Date(item.createdAt);
    const day = Number.isNaN(date.getTime()) ? "unknown" : localDateYmd(date);
    const at = index.get(day);
    if (at === undefined) {
      index.set(day, groups.length);
      groups.push({ day, items: [item] });
    } else {
      groups[at].items.push(item);
    }
  }
  return groups;
}

function ActivitySkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading activity">
      {Array.from({ length: 2 }).map((_, group) => (
        <div key={group} className="space-y-4">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5 pt-1">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ActivityPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const activity = useActivity(workspaceId);
  const items = activity.data ?? [];
  const groups = groupByDay(items);

  return (
    <PageShell width="narrow">
      <PageHeader
        icon={ActivityIcon}
        title="Activity"
        description="What the workspace has been doing — tasks, files, meetings, and comments."
      />
      {activity.isLoading ? (
        <ActivitySkeleton />
      ) : activity.isError ? (
        <ErrorState
          title="Couldn't load activity"
          description={activity.error.message}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void activity.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : !items.length ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Work in this workspace will show up here."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.day} aria-label={dayLabel(group.day)}>
              <h2 className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-2 bg-background/90 px-1 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
                {group.day === "unknown" ? "Earlier" : dayLabel(group.day)}
                <span className="h-px flex-1 bg-border" />
                <span className="font-medium normal-case tracking-normal text-subtle-foreground tabular">
                  {group.items.length}
                </span>
              </h2>
              <ol className="relative">
                {group.items.map((item, index) => {
                  const href = activityHref(item.entityType, item.entityId);
                  const actor = item.actor?.name ?? "Someone";
                  const meta = metaFor(item.entityType);
                  const Icon = meta.icon;
                  const last = index === group.items.length - 1;
                  return (
                    <li key={item.id} className="relative flex gap-3 pb-1">
                      {!last ? (
                        <span
                          aria-hidden
                          className="absolute -bottom-1.5 left-4 top-11 w-px bg-border"
                        />
                      ) : null}
                      <span className="relative mt-1.5 flex shrink-0 self-start">
                        <Avatar name={actor} size="default" />
                        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                          <Icon className="size-2.5" />
                        </span>
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg px-2 py-2">
                        <p className="text-base text-muted-foreground">
                          <span className="font-medium text-foreground">{actor}</span>{" "}
                          {href ? (
                            <Link
                              href={href}
                              className="rounded-sm text-foreground underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle-foreground">
                          <span className="capitalize">{meta.label}</span>
                          <span aria-hidden>·</span>
                          <Tooltip content={formatDateTime(item.createdAt)}>
                            <time
                              dateTime={item.createdAt}
                              className="tabular"
                              tabIndex={0}
                            >
                              {formatRelativeTime(item.createdAt)}
                            </time>
                          </Tooltip>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
