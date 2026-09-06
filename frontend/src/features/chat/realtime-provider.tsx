"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { chatKeys } from "@/features/chat/hooks";
import type { ChatMessage } from "@/features/chat/types";
import { collabKeys } from "@/features/collaboration/hooks";
import type { TaskComment } from "@/features/collaboration/types";
import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/session";
import { useWorkspaceStore } from "@/store/workspace-store";

type PresencePayload = {
  userId: string;
  status: "ONLINE" | "OFFLINE";
  lastSeenAt?: string;
  onlineUserIds?: string[];
};

type TypingPayload = {
  conversationId: string;
  userId: string;
  typing: boolean;
};

type RealtimeContextValue = {
  onlineUserIds: Set<string>;
  lastSeenAt: Record<string, string>;
  typingByConversation: Record<string, string[]>;
  joinConversation: (id: string) => void;
  leaveConversation: (id: string) => void;
  joinTask: (id: string) => void;
  leaveTask: (id: string) => void;
  emitTyping: (conversationId: string, typing: boolean) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function upsertMessage(list: ChatMessage[] | undefined, message: ChatMessage) {
  const current = list ?? [];
  const index = current.findIndex((item) => item.id === message.id);
  if (index >= 0) {
    const next = [...current];
    next[index] = message;
    return next;
  }
  return [...current, message];
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const socketRef = useRef<Socket | null>(null);
  const joinedConversations = useRef(new Set<string>());
  const joinedTasks = useRef(new Set<string>());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSeenAt, setLastSeenAt] = useState<Record<string, string>>({});
  const [typingByConversation, setTypingByConversation] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    const token = getAccessToken();
    if (!workspaceId || !token) {
      return;
    }
    const socket = io(env.wsUrl, {
      auth: { token, workspaceId },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      for (const id of joinedConversations.current) {
        socket.emit("join:conversation", { conversationId: id });
      }
      for (const id of joinedTasks.current) {
        socket.emit("join:task", { taskId: id });
      }
    });

    socket.on("presence", (payload: PresencePayload) => {
      setOnlineUserIds(new Set(payload.onlineUserIds ?? []));
      if (payload.status === "OFFLINE" && payload.lastSeenAt) {
        setLastSeenAt((current) => ({
          ...current,
          [payload.userId]: payload.lastSeenAt as string,
        }));
      }
    });

    socket.on("typing", (payload: TypingPayload) => {
      setTypingByConversation((current) => {
        const ids = new Set(current[payload.conversationId] ?? []);
        if (payload.typing) ids.add(payload.userId);
        else ids.delete(payload.userId);
        return { ...current, [payload.conversationId]: [...ids] };
      });
    });

    socket.on("message:new", (message: ChatMessage) => {
      queryClient.setQueryData(
        chatKeys.messages(workspaceId, message.conversationId),
        (current: ChatMessage[] | undefined) => upsertMessage(current, message),
      );
      void queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    });

    socket.on("message:updated", (message: ChatMessage) => {
      queryClient.setQueryData(
        chatKeys.messages(workspaceId, message.conversationId),
        (current: ChatMessage[] | undefined) => upsertMessage(current, message),
      );
    });

    socket.on("message:reaction", (message: ChatMessage) => {
      queryClient.setQueryData(
        chatKeys.messages(workspaceId, message.conversationId),
        (current: ChatMessage[] | undefined) => upsertMessage(current, message),
      );
    });

    socket.on("message:read", () => {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    });

    socket.on("notification:new", () => {
      void queryClient.invalidateQueries({
        queryKey: collabKeys.notifications(workspaceId),
      });
    });

    socket.on("activity:new", () => {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.activity(workspaceId),
      });
    });

    socket.on("comment:new", (comment: TaskComment & { taskId?: string }) => {
      if (comment.taskId) {
        queryClient.setQueryData(
          collabKeys.comments(workspaceId, comment.taskId),
          (current: TaskComment[] | undefined) => {
            const list = current ?? [];
            if (list.some((item) => item.id === comment.id)) return list;
            return [...list, comment];
          },
        );
      } else {
        void queryClient.invalidateQueries({
          queryKey: ["comments", workspaceId],
        });
      }
    });

    socket.on("comment:updated", () => {
      void queryClient.invalidateQueries({
        queryKey: ["comments", workspaceId],
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setOnlineUserIds(new Set());
      setTypingByConversation({});
    };
  }, [queryClient, workspaceId]);

  const joinConversation = useCallback((id: string) => {
    joinedConversations.current.add(id);
    socketRef.current?.emit("join:conversation", { conversationId: id });
  }, []);

  const leaveConversation = useCallback((id: string) => {
    joinedConversations.current.delete(id);
    socketRef.current?.emit("leave:conversation", { conversationId: id });
  }, []);

  const joinTask = useCallback((id: string) => {
    joinedTasks.current.add(id);
    socketRef.current?.emit("join:task", { taskId: id });
  }, []);

  const leaveTask = useCallback((id: string) => {
    joinedTasks.current.delete(id);
    socketRef.current?.emit("leave:task", { taskId: id });
  }, []);

  const emitTyping = useCallback((conversationId: string, typing: boolean) => {
    socketRef.current?.emit("typing", { conversationId, typing });
  }, []);

  const value = useMemo(
    () => ({
      onlineUserIds,
      lastSeenAt,
      typingByConversation,
      joinConversation,
      leaveConversation,
      joinTask,
      leaveTask,
      emitTyping,
    }),
    [
      emitTyping,
      joinConversation,
      joinTask,
      lastSeenAt,
      leaveConversation,
      leaveTask,
      onlineUserIds,
      typingByConversation,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

const FALLBACK: RealtimeContextValue = {
  onlineUserIds: new Set(),
  lastSeenAt: {},
  typingByConversation: {},
  joinConversation: () => undefined,
  leaveConversation: () => undefined,
  joinTask: () => undefined,
  leaveTask: () => undefined,
  emitTyping: () => undefined,
};

export function useRealtime() {
  return useContext(RealtimeContext) ?? FALLBACK;
}
