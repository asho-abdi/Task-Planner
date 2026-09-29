"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Hash,
  Lock,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn, formatRelativeTime, nativeSelectClass, nativeTextareaClass } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const REACTIONS = ["👍", "🎉", "✅", "👀", "❤️"];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

function otherMember(conversation: ChatConversation, userId?: string) {
  return conversation.members.find((item) => item.userId !== userId);
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white",
        online ? "bg-emerald-500" : "bg-slate-300",
      )}
    />
  );
}

export function WorkspaceChat({ selectedId }: { selectedId?: string | null }) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const user = useCurrentUser();
  const conversations = useConversations(workspaceId);
  const [activeId, setActiveId] = useState<string | null>(selectedId ?? null);

  useEffect(() => {
    if (selectedId) setActiveId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (activeId || !conversations.data?.length) return;
    const first =
      conversations.data.find((item) => item.kind === "CHANNEL") ??
      conversations.data[0];
    setActiveId(first.id);
  }, [activeId, conversations.data]);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100svh-56px)] min-h-0 overflow-hidden border-t border-[#E5E7EB] bg-white sm:-mx-6 sm:-my-6">
      <ConversationList
        conversations={conversations.data ?? []}
        loading={conversations.isLoading}
        activeId={activeId}
        userId={user.data?.id}
        onSelect={setActiveId}
      />
      {activeId ? (
        <ChatPane conversationId={activeId} compact={false} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a channel or conversation.
        </div>
      )}
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
    return <Skeleton className="h-80 w-full" />;
  }
  if (conversation.isError || !conversation.data) {
    return (
      <p className="text-sm text-muted-foreground">
        Project chat is available to project members.
      </p>
    );
  }
  return (
    <div className="flex h-[min(70vh,640px)] min-h-[420px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
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
}: {
  conversations: ChatConversation[];
  loading: boolean;
  activeId: string | null;
  userId?: string;
  onSelect: (id: string) => void;
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

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#E5E7EB] bg-[#F8FAFC]">
      <div className="border-b border-[#E5E7EB] px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#172033]">Chat</p>
        </div>
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-8 bg-white pl-8 text-[13px] shadow-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {loading ? <Skeleton className="h-24 w-full" /> : null}
        <Section
          title="Channels"
          action={
            canWrite ? (
              <button
                type="button"
                className="text-[#64748B] hover:text-[#172033]"
                onClick={() => setChannelOpen(true)}
                aria-label="New channel"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        >
          {channels.map((item) => (
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
        <Section
          title="Direct messages"
          action={
            canWrite ? (
              <button
                type="button"
                className="text-[#64748B] hover:text-[#172033]"
                onClick={() => setDmOpen(true)}
                aria-label="New message"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        >
          {directs.map((item) => {
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
          })}
        </Section>
        {projects.length ? (
          <Section title="Projects">
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
      </div>
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
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
          {title}
        </p>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
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
  const other = otherMember(conversation, userId);
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
        active
          ? "bg-white text-[#172033]"
          : "text-[#475569] hover:bg-white/80",
      )}
    >
      {conversation.kind === "DIRECT" ? (
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-primary">
          {initials(other?.user.name ?? title)}
          <PresenceDot online={online} />
        </span>
      ) : conversation.privacy === "PRIVATE" ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
      ) : (
        <Hash className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
      )}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {conversation.unreadCount > 0 ? (
        <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">
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
}: {
  conversationId: string;
  compact: boolean;
  canWriteOverride?: boolean;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const user = useCurrentUser();
  const {
    joinConversation,
    leaveConversation,
    typingByConversation,
  } = useRealtime();
  const conversation = useConversation(workspaceId, conversationId);
  const messages = useMessages(workspaceId, conversationId);
  const canWrite =
    canWriteOverride ?? Boolean(workspace && workspace.role !== "VIEWER");

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

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E5E7EB] px-4">
          <div>
            <p className="text-[13px] font-semibold text-[#172033]">
              {conversation.data
                ? conversationTitle(conversation.data, user.data?.id)
                : "Conversation"}
            </p>
            <p className="text-[12px] text-[#64748B]">
              {conversation.data?.description ||
                (conversation.data?.kind === "DIRECT"
                  ? "Direct message"
                  : conversation.data?.kind === "PROJECT"
                    ? "Project members only"
                    : "Workspace channel")}
            </p>
          </div>
        </header>
        <MessageList
          messages={messages.data ?? []}
          loading={messages.isLoading}
          userId={user.data?.id}
          conversationId={conversationId}
          canWrite={canWrite}
        />
        {typingNames.length ? (
          <p className="px-4 pb-1 text-xs text-[#64748B]">
            {typingNames.join(", ")} typing…
          </p>
        ) : null}
        {canWrite ? (
          <Composer
            conversationId={conversationId}
            members={conversation.data?.members ?? []}
          />
        ) : (
          <p className="border-t border-[#E5E7EB] px-4 py-3 text-sm text-muted-foreground">
            Viewers can read this conversation.
          </p>
        )}
      </section>
      {!compact ? (
        <ConversationDetails
          conversation={conversation.data}
          userId={user.data?.id}
        />
      ) : null}
    </>
  );
}

function MessageList({
  messages,
  loading,
  userId,
  conversationId,
  canWrite,
}: {
  messages: ChatMessage[];
  loading: boolean;
  userId?: string;
  conversationId: string;
  canWrite: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (loading) {
    return <Skeleton className="m-4 h-40" />;
  }

  return (
    <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No messages yet. Start the conversation.
        </p>
      ) : (
        messages.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            mine={message.author.id === userId}
            conversationId={conversationId}
            canWrite={canWrite}
            parent={messages.find((item) => item.id === message.parentId)}
          />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageRow({
  message,
  conversationId,
  canWrite,
  parent,
}: {
  message: ChatMessage;
  mine?: boolean;
  conversationId: string;
  canWrite: boolean;
  parent?: ChatMessage;
}) {
  const [menu, setMenu] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const react = useReactToMessage();

  return (
    <div className={cn("group flex gap-2.5 rounded-md px-1 py-1.5 hover:bg-[#F8FAFC]")}>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[10px] font-semibold text-primary">
        {initials(message.author.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[13px] font-medium text-[#172033]">{message.author.name}</p>
          <p className="text-[11px] text-[#94A3B8]">
            {formatRelativeTime(message.createdAt)}
          </p>
        </div>
        {parent ? (
          <p className="mt-1 truncate border-l-2 border-[#E5E7EB] pl-2 text-[12px] text-[#64748B]">
            {parent.author.name}: {parent.body}
          </p>
        ) : null}
        <div className="relative mt-0.5 text-[13px] leading-5 text-[#172033]">
          <MentionText body={message.body} />
          {canWrite ? (
            <button
              type="button"
              className="absolute -right-2 -top-2 hidden rounded-full border border-[#E5E7EB] bg-white p-1 text-[#64748B] shadow-sm group-hover:block"
              onClick={() => setMenu((open) => !open)}
              aria-label="Message actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {menu ? (
            <div className="absolute right-0 top-7 z-10 w-40 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
              <MenuItem
                label="Reply"
                onClick={() => {
                  setMenu(false);
                  document
                    .getElementById(`composer-${conversationId}`)
                    ?.setAttribute("data-reply", message.id);
                  window.dispatchEvent(
                    new CustomEvent("chat-reply", { detail: message }),
                  );
                }}
              />
              <div className="flex gap-1 px-2 py-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-md px-1 hover:bg-secondary"
                    onClick={() => {
                      setMenu(false);
                      void react.mutateAsync({
                        messageId: message.id,
                        emoji,
                        conversationId,
                      });
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <MenuItem
                label="Copy"
                onClick={() => {
                  void navigator.clipboard.writeText(message.body);
                  setMenu(false);
                }}
              />
              <MenuItem
                label="Create Task"
                onClick={() => {
                  setMenu(false);
                  setTaskOpen(true);
                }}
              />
            </div>
          ) : null}
        </div>
        {message.reactions.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                className="rounded-full border border-[#E5E7EB] bg-slate-50 px-2 py-0.5 text-xs"
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
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        ) : null}
        {message.files.length ? (
          <div className="mt-1 space-y-1">
            {message.files.map((file) => (
              <p key={file.id} className="text-xs text-primary">
                {file.originalName}
              </p>
            ))}
          </div>
        ) : null}
        {message.task ? (
          <Link
            href={`/app/tasks/${message.task.id}`}
            className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-primary"
          >
            Created Task · {message.task.title}
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

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-secondary"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MentionText({ body }: { body: string }) {
  const parts = body.split(/(@[\w.\-]+)/g);
  return (
    <p>
      {parts.map((part, index) =>
        part.startsWith("@") ? (
          <span key={`${part}-${index}`} className="font-medium text-primary">
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

  useEffect(() => {
    function onReply(event: Event) {
      const detail = (event as CustomEvent<ChatMessage>).detail;
      if (detail?.conversationId === conversationId) {
        setReply(detail);
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

  return (
    <form
      id={`composer-${conversationId}`}
      className="relative border-t border-[#E5E7EB] p-3"
      onSubmit={(event) => void submit(event)}
    >
      {reply ? (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-xs text-[#64748B]">
          <span>Replying to {reply.author.name}</span>
          <button type="button" onClick={() => setReply(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {mentionMatches.length ? (
        <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {mentionMatches.slice(0, 6).map((item) => (
            <button
              key={item.userId}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-secondary"
              onClick={() => {
                const parts = body.split(/\s/);
                parts[parts.length - 1] = `@${item.user.name.split(" ")[0]}`;
                setBody(`${parts.join(" ")} `);
                setMentionOpen(false);
              }}
            >
              {item.user.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <label className="cursor-pointer rounded-lg p-2 text-[#64748B] hover:bg-secondary">
          <Paperclip className="h-4 w-4" />
          <input
            type="file"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
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
              event.target.value = "";
            }}
          />
        </label>
        <textarea
          className={cn(nativeTextareaClass, "min-h-[44px] flex-1")}
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
        <Button type="submit" disabled={!body.trim() || send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {send.error ? (
        <p className="mt-1 text-xs text-destructive">{send.error.message}</p>
      ) : null}
    </form>
  );
}

function ConversationDetails({
  conversation,
  userId,
}: {
  conversation?: ChatConversation;
  userId?: string;
}) {
  const realtime = useRealtime();
  if (!conversation) {
    return <aside className="hidden w-[280px] shrink-0 border-l border-[#E5E7EB] lg:block" />;
  }
  const other = otherMember(conversation, userId);
  return (
    <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-l border-[#E5E7EB] bg-white p-4 lg:block">
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
        Details
      </p>
      <h2 className="mt-1 text-sm font-semibold text-[#172033]">
        {conversationTitle(conversation, userId)}
      </h2>
      {conversation.description ? (
        <p className="mt-2 text-sm text-[#64748B]">{conversation.description}</p>
      ) : null}
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-[#94A3B8]">Privacy</dt>
          <dd>{conversation.privacy === "PRIVATE" ? "Private" : "Public"}</dd>
        </div>
        {conversation.team ? (
          <div>
            <dt className="text-xs text-[#94A3B8]">Team</dt>
            <dd>{conversation.team.name}</dd>
          </div>
        ) : null}
        {conversation.project ? (
          <div>
            <dt className="text-xs text-[#94A3B8]">Project</dt>
            <dd>
              <Link
                href={`/app/projects/${conversation.project.id}`}
                className="text-primary"
              >
                {conversation.project.name}
              </Link>
            </dd>
          </div>
        ) : null}
        {conversation.kind === "DIRECT" && other ? (
          <div>
            <dt className="text-xs text-[#94A3B8]">Status</dt>
            <dd>
              {realtime.onlineUserIds.has(other.userId) || other.online
                ? "Online"
                : `Last seen ${formatRelativeTime(
                    realtime.lastSeenAt[other.userId] ?? other.lastSeenAt,
                  )}`}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-[#64748B]">
        Members
      </p>
      <ul className="mt-2 space-y-2">
        {conversation.members.map((member) => {
          const online =
            realtime.onlineUserIds.has(member.userId) || member.online;
          return (
            <li key={member.userId} className="flex items-center gap-2">
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-primary">
                {initials(member.user.name)}
                <PresenceDot online={online} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm">{member.user.name}</p>
                <p className="text-xs text-[#94A3B8]">
                  {online
                    ? "Online"
                    : formatRelativeTime(
                        realtime.lastSeenAt[member.userId] ?? member.lastSeenAt,
                      )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
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
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await create.mutateAsync({
              name,
              description: description || undefined,
              privacy,
              teamId: teamId || undefined,
              memberIds: privacy === "PRIVATE" ? memberIds : undefined,
            });
            setName("");
            setDescription("");
            onOpenChange(false);
          }}
        >
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Privacy</Label>
            <select
              className={nativeSelectClass}
              value={privacy}
              onChange={(event) => setPrivacy(event.target.value as ChatPrivacy)}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Team</Label>
            <select
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
          {privacy === "PRIVATE" ? (
            <div className="space-y-1">
              <Label>Members</Label>
              <select
                multiple
                className={cn(nativeSelectClass, "h-28")}
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
            </div>
          ) : null}
          {create.error ? (
            <p className="text-sm text-destructive">{create.error.message}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              Create
            </Button>
          </div>
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
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!userId) return;
            const conversation = await openDirect.mutateAsync(userId);
            onOpened(conversation.id);
          }}
        >
          <select
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
          {openDirect.error ? (
            <p className="text-sm text-destructive">{openDirect.error.message}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={!userId || openDirect.isPending}>
              Open
            </Button>
          </div>
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
        </DialogHeader>
        <form
          className="space-y-3"
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
            onClose();
          }}
        >
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <select
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
          <select
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
          <select
            className={nativeSelectClass}
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          {convert.error ? (
            <p className="text-sm text-destructive">{convert.error.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || convert.isPending}>
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
