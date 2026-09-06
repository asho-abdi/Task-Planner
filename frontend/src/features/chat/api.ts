import { apiRequest } from "@/lib/api-client";
import type {
  ActivityEvent,
  ChatConversation,
  ChatMessage,
  ConvertMessageInput,
  CreateChannelInput,
  SendMessageInput,
} from "@/features/chat/types";

export function listConversations() {
  return apiRequest<ChatConversation[]>("/chat/conversations");
}

export function createChannel(input: CreateChannelInput) {
  return apiRequest<ChatConversation>("/chat/channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function openDirect(userId: string) {
  return apiRequest<ChatConversation>("/chat/direct", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function getProjectConversation(projectId: string) {
  return apiRequest<ChatConversation>(`/chat/projects/${projectId}`);
}

export function getConversation(conversationId: string) {
  return apiRequest<ChatConversation>(`/chat/conversations/${conversationId}`);
}

export function listMessages(conversationId: string, before?: string) {
  const search = new URLSearchParams();
  if (before) search.set("before", before);
  const qs = search.toString();
  return apiRequest<ChatMessage[]>(
    `/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`,
  );
}

export function sendMessage(conversationId: string, input: SendMessageInput) {
  return apiRequest<ChatMessage>(
    `/chat/conversations/${conversationId}/messages`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function markConversationRead(conversationId: string) {
  return apiRequest<{ ok: boolean }>(
    `/chat/conversations/${conversationId}/read`,
    { method: "POST" },
  );
}

export function reactToMessage(messageId: string, emoji: string) {
  return apiRequest<ChatMessage>(`/chat/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export function convertMessageToTask(
  messageId: string,
  input: ConvertMessageInput,
) {
  return apiRequest<ChatMessage>(`/chat/messages/${messageId}/task`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listActivity() {
  return apiRequest<ActivityEvent[]>("/activity");
}
