"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/features/chat/api";
import type {
  ConvertMessageInput,
  CreateChannelInput,
  SendMessageInput,
} from "@/features/chat/types";
import { collabKeys } from "@/features/collaboration/hooks";
import { taskKeys } from "@/features/tasks/hooks";
import { useWorkspaceStore } from "@/store/workspace-store";

export const chatKeys = {
  all: (workspaceId: string) => ["chat", workspaceId] as const,
  conversations: (workspaceId: string) =>
    [...chatKeys.all(workspaceId), "conversations"] as const,
  conversation: (workspaceId: string, conversationId: string) =>
    [...chatKeys.all(workspaceId), "conversation", conversationId] as const,
  messages: (workspaceId: string, conversationId: string) =>
    [...chatKeys.all(workspaceId), "messages", conversationId] as const,
  project: (workspaceId: string, projectId: string) =>
    [...chatKeys.all(workspaceId), "project", projectId] as const,
  activity: (workspaceId: string) => ["activity", workspaceId] as const,
};

export function useConversations(workspaceId: string | null) {
  return useQuery({
    queryKey: chatKeys.conversations(workspaceId ?? "none"),
    queryFn: api.listConversations,
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });
}

export function useConversation(
  workspaceId: string | null,
  conversationId: string | null,
) {
  return useQuery({
    queryKey: chatKeys.conversation(
      workspaceId ?? "none",
      conversationId ?? "none",
    ),
    queryFn: () => api.getConversation(conversationId as string),
    enabled: Boolean(workspaceId) && Boolean(conversationId),
  });
}

export function useMessages(
  workspaceId: string | null,
  conversationId: string | null,
) {
  return useQuery({
    queryKey: chatKeys.messages(
      workspaceId ?? "none",
      conversationId ?? "none",
    ),
    queryFn: () => api.listMessages(conversationId as string),
    enabled: Boolean(workspaceId) && Boolean(conversationId),
    staleTime: 5_000,
  });
}

export function useProjectConversation(
  workspaceId: string | null,
  projectId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: chatKeys.project(workspaceId ?? "none", projectId ?? "none"),
    queryFn: () => api.getProjectConversation(projectId as string),
    enabled: Boolean(workspaceId) && Boolean(projectId) && enabled,
  });
}

export function useActivity(workspaceId: string | null) {
  return useQuery({
    queryKey: chatKeys.activity(workspaceId ?? "none"),
    queryFn: api.listActivity,
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });
}

function useInvalidateChat() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return (conversationId?: string) => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({
      queryKey: chatKeys.conversations(workspaceId),
    });
    if (conversationId) {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.conversation(workspaceId, conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.messages(workspaceId, conversationId),
      });
    }
  };
}

export function useCreateChannel() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (input: CreateChannelInput) => api.createChannel(input),
    onSuccess: (conversation) => invalidate(conversation.id),
  });
}

export function useOpenDirect() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (userId: string) => api.openDirect(userId),
    onSuccess: (conversation) => invalidate(conversation.id),
  });
}

export function useSendMessage(conversationId: string) {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (input: SendMessageInput) =>
      api.sendMessage(conversationId, input),
    onSuccess: () => invalidate(conversationId),
  });
}

export function useMarkConversationRead() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.markConversationRead(conversationId),
    onSuccess: (_data, conversationId) => invalidate(conversationId),
  });
}

export function useReactToMessage() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (input: { messageId: string; emoji: string; conversationId: string }) =>
      api.reactToMessage(input.messageId, input.emoji),
    onSuccess: (_data, input) => invalidate(input.conversationId),
  });
}

export function useConvertMessageToTask() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (input: {
      messageId: string;
      conversationId: string;
      payload: ConvertMessageInput;
    }) => api.convertMessageToTask(input.messageId, input.payload),
    onSuccess: (_data, input) => {
      invalidate(input.conversationId);
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: taskKeys.all(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: collabKeys.notifications(workspaceId),
        });
      }
    },
  });
}
