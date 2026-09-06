export type ChatKind = "CHANNEL" | "DIRECT" | "PROJECT";
export type ChatPrivacy = "PUBLIC" | "PRIVATE";

export type ChatPerson = {
  id: string;
  name: string;
  email: string;
};

export type ChatMember = {
  userId: string;
  lastReadAt: string | null;
  lastSeenAt: string | null;
  online: boolean;
  user: ChatPerson;
};

export type ChatLastMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

export type ChatConversation = {
  id: string;
  kind: ChatKind;
  name: string | null;
  description: string | null;
  privacy: ChatPrivacy;
  teamId: string | null;
  projectId: string | null;
  team: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  lastMessageAt: string | null;
  lastMessage: ChatLastMessage | null;
  unreadCount: number;
  members: ChatMember[];
};

export type ChatReaction = {
  emoji: string;
  userIds: string[];
  count: number;
};

export type ChatMessageFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: ChatPerson;
  reactions: ChatReaction[];
  files: ChatMessageFile[];
  task: { id: string; title: string; status: string } | null;
};

export type CreateChannelInput = {
  name: string;
  description?: string;
  teamId?: string;
  privacy?: ChatPrivacy;
  memberIds?: string[];
};

export type SendMessageInput = {
  body: string;
  parentId?: string;
};

export type ConvertMessageInput = {
  title?: string;
  assigneeId?: string;
  projectId?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
};

export type ActivityEvent = {
  id: string;
  type: string;
  title: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  actor: ChatPerson | null;
};

export function activityHref(entityType: string | null, entityId: string | null) {
  if (!entityId) return null;
  if (entityType === "task") return `/app/tasks/${entityId}`;
  if (entityType === "project") return `/app/projects/${entityId}`;
  if (entityType === "meeting") return `/app/meetings/${entityId}`;
  if (entityType === "conversation") return `/app/chat?c=${entityId}`;
  if (entityType === "file") return "/app/files";
  return null;
}
