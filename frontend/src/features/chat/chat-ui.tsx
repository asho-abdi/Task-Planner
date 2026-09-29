"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Copy,
  Eye,
  FolderKanban,
  Globe,
  Hash,
  ListPlus,
  ListTodo,
  Lock,
  MessageSquare,
  PanelRight,
  PanelRightClose,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/page-header";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/features/auth/hooks";
import { markConversationRead } from "@/features/chat/api";
import {
  useConversation,
  useConversations,
  useConvertMessageToTask,
  useCreateChannel,
  useMessages,
  useOpenDirect,
  useProjectConversation,
  useReactToMessage,
  useSendMessage,
  chatKeys,
} from "@/features/chat/hooks";
import { useRealtime } from "@/features/chat/realtime-provider";
import type {
  ChatConversation,
  ChatMessage,
  ChatPrivacy,
} from "@/features/chat/types";
import { useTeams, useUploadFile } from "@/features/collaboration/hooks";
import { useProjects } from "@/features/projects/hooks";
import { PRIORITIES, type Priority } from "@/features/projects/types";
import { useWorkspaceMembers } from "@/features/workspaces/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import {
  cn,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  localDateYmd,
  nativeSelectClass,
} from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const REACTIONS = ["👍", "🎉", "✅", "👀", "❤️"];
/** Consecutive messages from one author within this window are grouped. */
const GROUP_WINDOW_MS = 5 * 60_000;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function conversationTitle(conversation: ChatConversation, userId?: string) {
  if (conversation.kind === "CHANNEL") {
    return `#${conversation.name}`;
  }
  if (conversation.kind === "PROJECT") {
    return conversation.project?.name ?? "Project chat";
  }
  const other = conversation.members.find((item) => item.userId !== userId);
  return other?.user.name ?? "Direct message";
}

function conversationSubtitle(conversation?: ChatConversation) {
  return (
    conversation?.description ||
    (conversation?.kind === "DIRECT"
      ? "Direct message"
      : conversation?.kind === "PROJECT"
        ? "Project members only"
        : "Workspace channel")
  );
}

function otherMember(conversation: ChatConversation, userId?: string) {
  return conversation.members.find((item) => item.userId !== userId);
}

function lastSeenLabel(value: string | null | undefined) {
  return value ? `Last seen ${formatRelativeTime(value)}` : "Offline";
}

function priorityLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const key = localDateYmd(date);
  if (key === localDateYmd()) return "Today";
  if (key === localDateYmd(new Date(Date.now() - 86_400_000))) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** Channel/project glyph tile, or an avatar with presence for DMs. */
function ConversationGlyph({
  conversation,
  userId,
  online,
  size = "sm",
}: {
  conversation: ChatConversation;
  userId?: string;
  online: boolean;
  size?: "sm" | "md";
}) {
  if (conversation.kind === "DIRECT") {
    const other = otherMember(conversation, userId);
    return (
      <Avatar
        name={other?.user.name ?? conversationTitle(conversation, userId)}
        size={size === "md" ? "default" : "sm"}
        status={online ? "online" : "offline"}
      />
    );
  }
  const Icon =
    conversation.kind === "PROJECT"
      ? FolderKanban
      : conversation.privacy === "PRIVATE"
        ? Lock
        : Hash;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground",
        size === "md" ? "size-8" : "size-6",
      )}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  );
}

export function WorkspaceChat({ selectedId }: { selectedId?: string | null }) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const user = useCurrentUser();
  const conversations = useConversations(workspaceId);
  // A user pick only applies while the URL selection it was made under is current,
  // so a new `?c=` selection still takes over (same as syncing it in an effect).
  const [picked, setPicked] = useState<{
    id: string;
    under: string | null;
  } | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">(
    selectedId ? "chat" : "list",
  );

  const fallbackId = useMemo(() => {
    const list = conversations.data ?? [];
    if (!list.length) return null;
    return (list.find((item) => item.kind === "CHANNEL") ?? list[0]).id;
  }, [conversations.data]);

  const activeId =
    picked && picked.under === (selectedId ?? null)
      ? picked.id
      : (selectedId ?? fallbackId);

  function select(id: string) {
    setPicked({ id, under: selectedId ?? null });
    setMobileView("chat");
  }

  return (
    <div className="-mx-4 -mb-10 -mt-6 flex h-[calc(100svh-56px)] min-h-0 overflow-hidden bg-card sm:-mx-6 lg:-mx-8">
      <ConversationList
        className={cn(mobileView === "list" ? "flex w-full" : "hidden", "md:flex md:w-64 lg:w-72")}
        conversations={conversations.data ?? []}
        loading={conversations.isLoading}
        activeId={activeId}
        userId={user.data?.id}
        onSelect={select}
      />
      <div
        className={cn(
          "min-w-0 flex-1",
          mobileView === "chat" ? "flex" : "hidden",
          "md:flex",
        )}
      >
        {activeId ? (
          <ChatPane
            conversationId={activeId}
            compact={false}
            onBack={() => setMobileView("list")}
          />
        ) : conversations.isLoading ? (
          <div className="flex flex-1 flex-col">
            <div className="flex h-14 items-center gap-3 border-b border-border px-4">
              <Skeleton className="size-8 rounded-md" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-48" />
              </div>
            </div>
            <MessagesSkeleton />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title="No conversation selected"
              description="Pick a channel or direct message to start chatting."
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectChat({
  projectId,
  canWrite,
}: {
  projectId: string;
  canWrite: boolean;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const conversation = useProjectConversation(workspaceId, projectId);
  if (conversation.isLoading) {
    return (
      <div className="h-[min(70vh,640px)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <MessagesSkeleton />
      </div>
    );
  }
  if (conversation.isError || !conversation.data) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <EmptyState
          compact
          icon={Lock}
          title="Project chat is private"
          description="Project chat is available to project members."
        />
      </div>
    );
  }
  return (
    <div className="flex h-[min(70vh,640px)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <ChatPane
        conversationId={conversation.data.id}
        compact
        canWriteOverride={canWrite}
      />
    </div>
  );
}

function ConversationList({
  conversations,
  loading,
  activeId,
  userId,
  onSelect,
  className,
}: {
  conversations: ChatConversation[];
  loading: boolean;
  activeId: string | null;
  userId?: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const realtime = useRealtime();
  const [query, setQuery] = useState("");
  const [channelOpen, setChannelOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const workspace = useCurrentWorkspace();
  const canWrite = workspace && workspace.role !== "VIEWER";

  const filtered = conversations.filter((item) => {
    const title = conversationTitle(item, userId).toLowerCase();
    return title.includes(query.trim().toLowerCase());
  });
  const channels = filtered.filter((item) => item.kind === "CHANNEL");
  const directs = filtered.filter((item) => item.kind === "DIRECT");
  const projects = filtered.filter((item) => item.kind === "PROJECT");
  const searching = query.trim().length > 0;

  return (
    <aside
      className={cn(
        "min-h-0 shrink-0 flex-col border-r border-border bg-muted/50",
        className,
      )}
    >
      <div className="space-y-3 border-b border-border px-3 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
            Chat
          </h2>
          {canWrite ? (
            <DropdownMenu>
              <Tooltip content="New conversation">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="New conversation">
                    <Plus />
                  </Button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setChannelOpen(true)}>
                  <Hash />
                  New channel
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDmOpen(true)}>
                  <MessageSquare />
                  New direct message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-8 pl-8"
          />
        </div>
      </div>
      <nav
        aria-label="Conversations"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3"
      >
        {loading ? (
          <div className="space-y-1.5 px-2" role="status" aria-label="Loading conversations">
            <Skeleton className="mb-3 h-2.5 w-20" />
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2.5 py-1">
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <Section
              title="Channels"
              count={channels.length}
              action={
                canWrite ? (
                  <Tooltip content="New channel">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setChannelOpen(true)}
                      aria-label="New channel"
                    >
                      <Plus />
                    </Button>
                  </Tooltip>
                ) : null
              }
            >
              {channels.length ? (
                channels.map((item) => (
                  <ConversationButton
                    key={item.id}
                    conversation={item}
                    userId={userId}
                    active={item.id === activeId}
                    online={false}
                    onSelect={onSelect}
                  />
                ))
              ) : (
                <SectionEmpty>{searching ? "No matching channels" : "No channels yet"}</SectionEmpty>
              )}
            </Section>
            <Section
              title="Direct messages"
              count={directs.length}
              action={
                canWrite ? (
                  <Tooltip content="New message">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDmOpen(true)}
                      aria-label="New message"
                    >
                      <Plus />
                    </Button>
                  </Tooltip>
                ) : null
              }
            >
              {directs.length ? (
                directs.map((item) => {
                  const other = otherMember(item, userId);
                  const online =
                    Boolean(other && realtime.onlineUserIds.has(other.userId)) ||
                    Boolean(other?.online);
                  return (
                    <ConversationButton
                      key={item.id}
                      conversation={item}
                      userId={userId}
                      active={item.id === activeId}
                      online={online}
                      onSelect={onSelect}
                    />
                  );
                })
              ) : (
                <SectionEmpty>
                  {searching ? "No matching people" : "No direct messages yet"}
                </SectionEmpty>
              )}
            </Section>
            {projects.length ? (
              <Section title="Projects" count={projects.length}>
                {projects.map((item) => (
                  <ConversationButton
                    key={item.id}
                    conversation={item}
                    userId={userId}
                    active={item.id === activeId}
                    online={false}
                    onSelect={onSelect}
                  />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </nav>
      <CreateChannelDialog open={channelOpen} onOpenChange={setChannelOpen} />
      <CreateDirectDialog
        open={dmOpen}
        onOpenChange={setDmOpen}
        onOpened={(id) => {
          onSelect(id);
          setDmOpen(false);
        }}
      />
    </aside>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex h-7 items-center justify-between pl-2 pr-1">
        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle-foreground">
          {title}
          {count ? <span className="ml-1.5 tabular font-medium">{count}</span> : null}
        </p>
        {action}
      </div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function SectionEmpty({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1 text-sm text-subtle-foreground">{children}</p>;
}

function ConversationButton({
  conversation,
  userId,
  active,
  online,
  onSelect,
}: {
  conversation: ChatConversation;
  userId?: string;
  active: boolean;
  online: boolean;
  onSelect: (id: string) => void;
}) {
  const title = conversationTitle(conversation, userId);
  const unread = conversation.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-base transition-colors duration-150",
        focusRing,
        active
          ? "bg-card text-foreground shadow-xs ring-1 ring-border"
          : unread
            ? "font-medium text-foreground hover:bg-accent"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <ConversationGlyph conversation={conversation} userId={userId} online={online} />
      <span className="min-w-0 flex-1 truncate">
        {conversation.kind === "CHANNEL" ? conversation.name : title}
      </span>
      {unread ? (
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-semibold tabular text-primary-foreground"
          aria-label={`${conversation.unreadCount} unread`}
        >
          {conversation.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function ChatPane({
  conversationId,
  compact,
  canWriteOverride,
  onBack,
}: {
  conversationId: string;
  compact: boolean;
  canWriteOverride?: boolean;
  onBack?: () => void;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const user = useCurrentUser();
  const realtime = useRealtime();
  const { joinConversation, leaveConversation, typingByConversation } = realtime;
  const conversation = useConversation(workspaceId, conversationId);
  const messages = useMessages(workspaceId, conversationId);
  const canWrite =
    canWriteOverride ?? Boolean(workspace && workspace.role !== "VIEWER");
  const [detailsOpen, setDetailsOpen] = useState(true);

  useEffect(() => {
    joinConversation(conversationId);
    void markConversationRead(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  const typingIds = (typingByConversation[conversationId] ?? []).filter(
    (id) => id !== user.data?.id,
  );
  const typingNames = (conversation.data?.members ?? [])
    .filter((item) => typingIds.includes(item.userId))
    .map((item) => item.user.name);

  const data = conversation.data;
  const other = data ? otherMember(data, user.data?.id) : undefined;
  const otherOnline = Boolean(
    other && (realtime.onlineUserIds.has(other.userId) || other.online),
  );
  const members = data?.members ?? [];

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
          {onBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="-ml-1 md:hidden"
              aria-label="Back to conversations"
              onClick={onBack}
            >
              <ArrowLeft />
            </Button>
          ) : null}
          {data ? (
            <ConversationGlyph
              conversation={data}
              userId={user.data?.id}
              online={otherOnline}
              size="md"
            />
          ) : (
            <Skeleton className="size-8 rounded-md" />
          )}
          <div className="min-w-0 flex-1">
            {data ? (
              <>
                <h2 className="truncate text-md font-semibold text-foreground">
                  {conversationTitle(data, user.data?.id)}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {data.kind === "DIRECT" && other
                    ? otherOnline
                      ? "Online"
                      : lastSeenLabel(realtime.lastSeenAt[other.userId] ?? other.lastSeenAt)
                    : conversationSubtitle(data)}
                </p>
              </>
            ) : (
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-48" />
              </div>
            )}
          </div>
          {data && data.kind !== "DIRECT" && members.length ? (
            <div
              className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"
              title={members.map((item) => item.user.name).join(", ")}
            >
              <AvatarStack
                people={members.map((item) => ({ id: item.userId, name: item.user.name }))}
                max={3}
                size="xs"
              />
              <span className="tabular">
                {members.length} {members.length === 1 ? "member" : "members"}
              </span>
            </div>
          ) : null}
          {!compact ? (
            <Tooltip content={detailsOpen ? "Hide details" : "Show details"}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden lg:inline-flex"
                aria-label={detailsOpen ? "Hide details" : "Show details"}
                aria-pressed={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
              >
                {detailsOpen ? <PanelRightClose /> : <PanelRight />}
              </Button>
            </Tooltip>
          ) : null}
        </header>
        <MessageList
          messages={messages.data ?? []}
          loading={messages.isLoading}
          userId={user.data?.id}
          conversationId={conversationId}
          canWrite={canWrite}
          emptyHint={data ? conversationTitle(data, user.data?.id) : undefined}
        />
        <div className="h-5 shrink-0 px-4 sm:px-5" aria-live="polite">
          {typingNames.length ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-in">
              <span className="flex gap-0.5" aria-hidden>
                <span className="size-1 animate-pulse rounded-full bg-subtle-foreground" />
                <span className="size-1 animate-pulse rounded-full bg-subtle-foreground [animation-delay:150ms]" />
                <span className="size-1 animate-pulse rounded-full bg-subtle-foreground [animation-delay:300ms]" />
              </span>
              {typingNames.join(", ")} typing…
            </p>
          ) : null}
        </div>
        {canWrite ? (
          <Composer
            conversationId={conversationId}
            members={conversation.data?.members ?? []}
          />
        ) : (
          <div className="shrink-0 px-3 pb-3 sm:px-4 sm:pb-4">
            <p className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              <Eye className="size-4" />
              Viewers can read this conversation.
            </p>
          </div>
        )}
      </section>
      {!compact ? (
        <ConversationDetails
          open={detailsOpen}
          conversation={conversation.data}
          userId={user.data?.id}
        />
      ) : null}
    </>
  );
}

function MessagesSkeleton() {
  return (
    <div className="flex-1 space-y-5 overflow-hidden p-4" role="status" aria-label="Loading messages">
      {[
        { mine: false, widths: ["w-56", "w-40"] },
        { mine: true, widths: ["w-48"] },
        { mine: false, widths: ["w-64"] },
        { mine: true, widths: ["w-36", "w-52"] },
      ].map((row, index) => (
        <div key={index} className={cn("flex gap-2.5", row.mine && "flex-row-reverse")}>
          {!row.mine ? <Skeleton className="size-8 shrink-0 rounded-full" /> : null}
          <div className={cn("flex flex-col gap-1", row.mine ? "items-end" : "items-start")}>
            <Skeleton className="h-2.5 w-24" />
            {row.widths.map((width) => (
              <Skeleton key={width} className={cn("h-9 max-w-[60vw] rounded-xl", width)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type MessageItem =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; message: ChatMessage; first: boolean; last: boolean };

function buildItems(messages: ChatMessage[]): MessageItem[] {
  const items: MessageItem[] = [];
  let lastDay = "";
  messages.forEach((message, index) => {
    const day = localDateYmd(new Date(message.createdAt));
    if (day !== lastDay) {
      items.push({ kind: "day", key: `day-${day}`, label: dayLabel(message.createdAt) });
      lastDay = day;
    }
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const joins = (a?: ChatMessage, b?: ChatMessage) =>
      Boolean(
        a &&
          b &&
          a.author.id === b.author.id &&
          !b.parentId &&
          localDateYmd(new Date(a.createdAt)) === localDateYmd(new Date(b.createdAt)) &&
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() < GROUP_WINDOW_MS,
      );
    items.push({
      kind: "message",
      message,
      first: !joins(prev, message),
      last: !joins(message, next),
    });
  });
  return items;
}

function MessageList({
  messages,
  loading,
  userId,
  conversationId,
  canWrite,
  emptyHint,
}: {
  messages: ChatMessage[];
  loading: boolean;
  userId?: string;
  conversationId: string;
  canWrite: boolean;
  emptyHint?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const items = useMemo(() => buildItems(messages), [messages]);

  if (loading) {
    return <MessagesSkeleton />;
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-4">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            compact
            icon={MessageSquare}
            title="No messages yet"
            description={
              emptyHint
                ? `This is the start of ${emptyHint}. Say hello!`
                : "Start the conversation."
            }
          />
        </div>
      ) : (
        items.map((item) =>
          item.kind === "day" ? (
            <div
              key={item.key}
              className="my-4 flex items-center gap-3 px-4 first:mt-0"
              role="separator"
              aria-label={item.label}
            >
              <span className="h-px flex-1 bg-border" />
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-2xs font-medium text-muted-foreground">
                {item.label}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : (
            <MessageRow
              key={item.message.id}
              message={item.message}
              mine={item.message.author.id === userId}
              userId={userId}
              first={item.first}
              last={item.last}
              conversationId={conversationId}
              canWrite={canWrite}
              parent={messages.find((entry) => entry.id === item.message.parentId)}
            />
          ),
        )
      )}
    </div>
  );
}

function MessageRow({
  message,
  mine = false,
  userId,
  first = true,
  last = true,
  conversationId,
  canWrite,
  parent,
}: {
  message: ChatMessage;
  mine?: boolean;
  userId?: string;
  first?: boolean;
  last?: boolean;
  conversationId: string;
  canWrite: boolean;
  parent?: ChatMessage;
}) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [toolbarPinned, setToolbarPinned] = useState(false);
  const react = useReactToMessage();

  function startReply() {
    document
      .getElementById(`composer-${conversationId}`)
      ?.setAttribute("data-reply", message.id);
    window.dispatchEvent(new CustomEvent("chat-reply", { detail: message }));
  }

  return (
    <div
      className={cn(
        "group flex gap-2.5 px-3 sm:px-4",
        mine && "flex-row-reverse",
        first ? "mt-3 first:mt-0" : "mt-0.5",
      )}
    >
      {!mine ? (
        first ? (
          <Avatar name={message.author.name} size="default" className="mt-5" />
        ) : (
          <span className="w-8 shrink-0" aria-hidden />
        )
      ) : null}
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]",
          mine ? "items-end" : "items-start",
        )}
      >
        {first ? (
          <div
            className={cn(
              "mb-1 flex items-baseline gap-2 px-1",
              mine && "flex-row-reverse",
            )}
          >
            <span className="text-sm font-medium text-foreground">
              {mine ? "You" : message.author.name}
            </span>
            <time
              dateTime={message.createdAt}
              title={formatDateTime(message.createdAt)}
              className="text-2xs text-subtle-foreground"
            >
              {formatTime(message.createdAt)}
            </time>
          </div>
        ) : null}
        <div className="relative max-w-full">
          <div
            className={cn(
              "max-w-full rounded-xl px-3.5 py-2 text-base leading-relaxed",
              mine
                ? "bg-primary-soft text-primary-soft-foreground"
                : "bg-muted text-foreground",
              mine
                ? cn(!first && "rounded-tr-sm", !last && "rounded-br-sm")
                : cn(!first && "rounded-tl-sm", !last && "rounded-bl-sm"),
            )}
            title={first ? undefined : formatDateTime(message.createdAt)}
          >
            {parent ? (
              <p
                className={cn(
                  "mb-1.5 truncate border-l-2 pl-2 text-sm opacity-80",
                  mine ? "border-primary/40" : "border-border-strong",
                )}
              >
                <span className="font-medium">{parent.author.name}:</span> {parent.body}
              </p>
            ) : null}
            <MentionText body={message.body} />
            {message.files.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.files.map((file) => (
                  <span
                    key={file.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                    title={file.originalName}
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.originalName}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {canWrite ? (
            <div
              className={cn(
                "absolute -top-4 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md transition-opacity duration-150",
                mine ? "right-2" : "left-2",
                toolbarPinned
                  ? "opacity-100"
                  : "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
              )}
            >
              <DropdownMenu onOpenChange={setToolbarPinned}>
                <Tooltip content="Add reaction">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="Add reaction">
                      <ThumbsUp />
                    </Button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent
                  align={mine ? "end" : "start"}
                  className="flex min-w-0 gap-0.5"
                >
                  {REACTIONS.map((emoji) => (
                    <DropdownMenuItem
                      key={emoji}
                      className="justify-center px-1.5 text-md"
                      aria-label={`React with ${emoji}`}
                      onSelect={() => {
                        void react
                          .mutateAsync({
                            messageId: message.id,
                            emoji,
                            conversationId,
                          })
                          .catch(() => undefined);
                      }}
                    >
                      {emoji}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip content="Reply in thread">
                <Button variant="ghost" size="icon-xs" aria-label="Reply" onClick={startReply}>
                  <Reply />
                </Button>
              </Tooltip>
              <Tooltip content="Convert to task">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Create task from message"
                  onClick={() => setTaskOpen(true)}
                >
                  <ListPlus />
                </Button>
              </Tooltip>
              <Tooltip content="Copy text">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Copy message"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(message.body)
                      .then(() => toast.success("Message copied"))
                      .catch(() => undefined);
                  }}
                >
                  <Copy />
                </Button>
              </Tooltip>
            </div>
          ) : null}
        </div>
        {message.reactions.length ? (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
            {message.reactions.map((reaction) => {
              const reacted = Boolean(userId && reaction.userIds.includes(userId));
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  disabled={!canWrite}
                  aria-pressed={reacted}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors duration-150 disabled:cursor-default",
                    focusRing,
                    reacted
                      ? "border-primary/30 bg-primary-soft text-primary-soft-foreground"
                      : "border-border bg-card text-muted-foreground enabled:hover:bg-accent",
                  )}
                  onClick={() =>
                    canWrite
                      ? void react.mutateAsync({
                          messageId: message.id,
                          emoji: reaction.emoji,
                          conversationId,
                        })
                      : undefined
                  }
                >
                  <span>{reaction.emoji}</span>
                  <span className="tabular font-medium">{reaction.count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {message.task ? (
          <Link
            href={`/app/tasks/${message.task.id}`}
            className={cn(
              "mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-soft-foreground transition-colors hover:bg-primary-soft/70",
              focusRing,
            )}
          >
            <ListTodo className="size-3.5 shrink-0" />
            <span className="truncate">Created Task · {message.task.title}</span>
          </Link>
        ) : null}
      </div>
      {taskOpen ? (
        <ConvertMessageDialog
          message={message}
          conversationId={conversationId}
          onClose={() => setTaskOpen(false)}
        />
      ) : null}
    </div>
  );
}

function MentionText({ body }: { body: string }) {
  const parts = body.split(/(@[\w.\-]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) =>
        part.startsWith("@") ? (
          <span key={`${part}-${index}`} className="font-semibold text-primary">
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </p>
  );
}

function Composer({
  conversationId,
  members,
}: {
  conversationId: string;
  members: ChatConversation["members"];
}) {
  const send = useSendMessage(conversationId);
  const upload = useUploadFile();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const realtime = useRealtime();
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const typingTimer = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onReply(event: Event) {
      const detail = (event as CustomEvent<ChatMessage>).detail;
      if (detail?.conversationId === conversationId) {
        setReply(detail);
        textRef.current?.focus();
      }
    }
    window.addEventListener("chat-reply", onReply);
    return () => window.removeEventListener("chat-reply", onReply);
  }, [conversationId]);

  function handleChange(value: string) {
    setBody(value);
    realtime.emitTyping(conversationId, true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      realtime.emitTyping(conversationId, false);
    }, 1200);
    const at = value.split(/\s/).pop() ?? "";
    setMentionOpen(at.startsWith("@") && at.length > 1);
  }

  const mentionQuery = (body.split(/\s/).pop() ?? "").slice(1).toLowerCase();
  const mentionMatches = mentionOpen
    ? members.filter((item) =>
        item.user.name.toLowerCase().includes(mentionQuery),
      )
    : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    await send.mutateAsync({
      body: body.trim(),
      parentId: reply?.id,
    });
    setBody("");
    setReply(null);
    realtime.emitTyping(conversationId, false);
  }

  const uploading = upload.isPending;

  return (
    <form
      id={`composer-${conversationId}`}
      className="relative shrink-0 px-3 pb-3 sm:px-4 sm:pb-4"
      onSubmit={(event) => void submit(event)}
    >
      {mentionMatches.length ? (
        <div className="absolute bottom-full left-3 right-3 z-20 mb-1 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg animate-scale-in sm:left-4 sm:right-auto sm:w-64">
          <p className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-subtle-foreground">
            Mention
          </p>
          {mentionMatches.slice(0, 6).map((item) => (
            <button
              key={item.userId}
              type="button"
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-base transition-colors hover:bg-accent",
                focusRing,
              )}
              onClick={() => {
                const parts = body.split(/\s/);
                parts[parts.length - 1] = `@${item.user.name.split(" ")[0]}`;
                setBody(`${parts.join(" ")} `);
                setMentionOpen(false);
                textRef.current?.focus();
              }}
            >
              <Avatar name={item.user.name} size="xs" />
              <span className="truncate">{item.user.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="rounded-xl border border-input bg-card shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
        {reply ? (
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
            <Reply className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Replying to <span className="font-medium text-foreground">{reply.author.name}</span>
              <span className="text-subtle-foreground"> — {reply.body}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss reply"
              onClick={() => setReply(null)}
            >
              <X />
            </Button>
          </div>
        ) : null}
        <div className="flex items-end gap-1 p-1.5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            tabIndex={-1}
            onChange={async (event) => {
              const input = event.target;
              const file = input.files?.[0];
              if (!file) return;
              const created = await send.mutateAsync({
                body: `Shared ${file.name}`,
              });
              await upload.mutateAsync({
                file,
                attach: { messageId: created.id, conversationId },
              });
              if (workspaceId) {
                void queryClient.invalidateQueries({
                  queryKey: chatKeys.messages(workspaceId, conversationId),
                });
              }
              input.value = "";
              toast.success("File shared");
            }}
          />
          <Tooltip content="Attach file">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach file"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip />
            </Button>
          </Tooltip>
          <textarea
            ref={textRef}
            rows={1}
            aria-label="Message"
            className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-base leading-snug text-foreground field-sizing-content placeholder:text-subtle-foreground focus:outline-none"
            value={body}
            placeholder="Write a message. Use @name to mention."
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(event);
              }
            }}
          />
          <Tooltip content="Send">
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Send message"
              disabled={!body.trim()}
              loading={send.isPending}
            >
              <Send />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        {send.error ? (
          <p className="text-xs text-danger-soft-foreground">{send.error.message}</p>
        ) : (
          <span />
        )}
        <p className="hidden text-2xs text-subtle-foreground sm:block">
          <span className="font-medium">Enter</span> to send ·{" "}
          <span className="font-medium">Shift + Enter</span> for a new line
        </p>
      </div>
    </form>
  );
}

function ConversationDetails({
  open,
  conversation,
  userId,
}: {
  open: boolean;
  conversation?: ChatConversation;
  userId?: string;
}) {
  const realtime = useRealtime();
  const panelClass = cn(
    "w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card",
    open ? "hidden lg:flex" : "hidden",
  );
  if (!conversation) {
    return (
      <aside className={panelClass}>
        <div className="space-y-3 p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
        </div>
      </aside>
    );
  }
  const other = otherMember(conversation, userId);
  const otherOnline = Boolean(
    other && (realtime.onlineUserIds.has(other.userId) || other.online),
  );
  return (
    <aside className={panelClass} aria-label="Conversation details">
      <div className="border-b border-border p-5">
        {conversation.kind === "DIRECT" && other ? (
          <div className="flex flex-col items-center text-center">
            <Avatar
              name={other.user.name}
              size="xl"
              status={otherOnline ? "online" : "offline"}
            />
            <h3 className="mt-3 text-md font-semibold text-foreground">{other.user.name}</h3>
            <p className="text-sm text-muted-foreground">{other.user.email}</p>
          </div>
        ) : (
          <>
            <p className="text-2xs font-semibold uppercase tracking-wider text-subtle-foreground">
              Details
            </p>
            <h3 className="mt-1.5 truncate text-md font-semibold text-foreground">
              {conversationTitle(conversation, userId)}
            </h3>
            {conversation.description ? (
              <p className="mt-1.5 text-sm text-muted-foreground">{conversation.description}</p>
            ) : null}
          </>
        )}
      </div>
      <dl className="space-y-3 border-b border-border p-5 text-sm">
        <DetailRow
          icon={conversation.privacy === "PRIVATE" ? Lock : Globe}
          label="Privacy"
        >
          {conversation.privacy === "PRIVATE" ? "Private" : "Public"}
        </DetailRow>
        {conversation.team ? (
          <DetailRow icon={Users} label="Team">
            {conversation.team.name}
          </DetailRow>
        ) : null}
        {conversation.project ? (
          <DetailRow icon={FolderKanban} label="Project">
            <Link
              href={`/app/projects/${conversation.project.id}`}
              className={cn("rounded-sm font-medium text-primary hover:underline", focusRing)}
            >
              {conversation.project.name}
            </Link>
          </DetailRow>
        ) : null}
        {conversation.kind === "DIRECT" && other ? (
          <DetailRow icon={Eye} label="Status">
            {otherOnline
              ? "Online"
              : lastSeenLabel(realtime.lastSeenAt[other.userId] ?? other.lastSeenAt)}
          </DetailRow>
        ) : null}
      </dl>
      <div className="p-5">
        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle-foreground">
          Members <span className="tabular">{conversation.members.length}</span>
        </p>
        <ul className="mt-3 space-y-3">
          {conversation.members.map((member) => {
            const online =
              realtime.onlineUserIds.has(member.userId) || member.online;
            return (
              <li key={member.userId} className="flex items-center gap-2.5">
                <Avatar
                  name={member.user.name}
                  size="default"
                  status={online ? "online" : "offline"}
                />
                <div className="min-w-0">
                  <p className="truncate text-base text-foreground">
                    {member.user.name}
                    {member.userId === userId ? (
                      <span className="text-subtle-foreground"> (you)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-subtle-foreground">
                    {online
                      ? "Online"
                      : lastSeenLabel(
                          realtime.lastSeenAt[member.userId] ?? member.lastSeenAt,
                        )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Lock;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-subtle-foreground">{label}</dt>
        <dd className="text-foreground">{children}</dd>
      </div>
    </div>
  );
}

function CreateChannelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateChannel();
  const teams = useTeams(useWorkspaceStore((state) => state.currentWorkspaceId));
  const members = useWorkspaceMembers(
    useWorkspaceStore((state) => state.currentWorkspaceId),
    open,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<ChatPrivacy>("PUBLIC");
  const [teamId, setTeamId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>
            Channels keep conversations about a topic in one place.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await create.mutateAsync({
              name,
              description: description || undefined,
              privacy,
              teamId: teamId || undefined,
              memberIds: privacy === "PRIVATE" ? memberIds : undefined,
            });
            toast.success(`#${name} created`);
            setName("");
            setDescription("");
            onOpenChange(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
              <Input
                id="channel-name"
                className="pl-8"
                placeholder="e.g. design-reviews"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-description">Description</Label>
            <Input
              id="channel-description"
              placeholder="What is this channel about?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="channel-privacy">Privacy</Label>
              <select
                id="channel-privacy"
                className={nativeSelectClass}
                value={privacy}
                onChange={(event) => setPrivacy(event.target.value as ChatPrivacy)}
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-team">Team</Label>
              <select
                id="channel-team"
                className={nativeSelectClass}
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                <option value="">Workspace</option>
                {(teams.data ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {privacy === "PRIVATE" ? (
            <div className="space-y-2">
              <Label htmlFor="channel-members">Members</Label>
              <select
                id="channel-members"
                multiple
                className={cn(nativeSelectClass, "h-28 py-1")}
                value={memberIds}
                onChange={(event) =>
                  setMemberIds(
                    Array.from(event.target.selectedOptions).map(
                      (option) => option.value,
                    ),
                  )
                }
              >
                {(members.data ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-subtle-foreground">
                Hold Ctrl (or Cmd) to select several people.
              </p>
            </div>
          ) : null}
          {create.error ? (
            <p className="text-sm text-danger-soft-foreground">{create.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              loading={create.isPending}
            >
              Create channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateDirectDialog({
  open,
  onOpenChange,
  onOpened,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (id: string) => void;
}) {
  const members = useWorkspaceMembers(
    useWorkspaceStore((state) => state.currentWorkspaceId),
    open,
  );
  const user = useCurrentUser();
  const openDirect = useOpenDirect();
  const [userId, setUserId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>Start a private conversation with a teammate.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!userId) return;
            const conversation = await openDirect.mutateAsync(userId);
            onOpened(conversation.id);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="dm-user">Teammate</Label>
            <select
              id="dm-user"
              className={nativeSelectClass}
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">Choose a teammate</option>
              {(members.data ?? [])
                .filter((item) => item.userId !== user.data?.id)
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
            </select>
          </div>
          {openDirect.error ? (
            <p className="text-sm text-danger-soft-foreground">{openDirect.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!userId} loading={openDirect.isPending}>
              Open conversation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConvertMessageDialog({
  message,
  conversationId,
  onClose,
}: {
  message: ChatMessage;
  conversationId: string;
  onClose: () => void;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const projects = useProjects(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const convert = useConvertMessageToTask();
  const conversation = useConversation(workspaceId, conversationId);
  const [title, setTitle] = useState(message.body.slice(0, 200));
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState(conversation.data?.projectId ?? "");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Turn this message from {message.author.name} into a trackable task.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await convert.mutateAsync({
              messageId: message.id,
              conversationId,
              payload: {
                title,
                assigneeId: assigneeId || undefined,
                projectId: projectId || undefined,
                priority,
                dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
              },
            });
            toast.success("Task created from message");
            onClose();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="convert-title">Title</Label>
            <Input
              id="convert-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="convert-assignee">Assignee</Label>
              <select
                id="convert-assignee"
                className={nativeSelectClass}
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {(members.data ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-project">Project</Label>
              <select
                id="convert-project"
                className={nativeSelectClass}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">No project</option>
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-priority">Priority</Label>
              <select
                id="convert-priority"
                className={nativeSelectClass}
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {priorityLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-due">Due date</Label>
              <Input
                id="convert-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          {convert.error ? (
            <p className="text-sm text-danger-soft-foreground">{convert.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()} loading={convert.isPending}>
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
