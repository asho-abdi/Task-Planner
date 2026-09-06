import { Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

type SocketMeta = {
  userId: string;
  workspaceId: string;
};

@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  private readonly sockets = new Map<string, SocketMeta>();
  private readonly online = new Map<string, Set<string>>();

  attach(server: Server) {
    this.server = server;
  }

  register(socket: Socket, meta: SocketMeta) {
    this.sockets.set(socket.id, meta);
    const set = this.online.get(meta.workspaceId) ?? new Set<string>();
    set.add(meta.userId);
    this.online.set(meta.workspaceId, set);
    void socket.join(`user:${meta.userId}`);
    void socket.join(`workspace:${meta.workspaceId}`);
  }

  unregister(socket: Socket) {
    const meta = this.sockets.get(socket.id);
    this.sockets.delete(socket.id);
    if (!meta) {
      return meta;
    }
    const stillOnline = [...this.sockets.values()].some(
      (item) =>
        item.userId === meta.userId && item.workspaceId === meta.workspaceId,
    );
    if (!stillOnline) {
      this.online.get(meta.workspaceId)?.delete(meta.userId);
    }
    return stillOnline ? undefined : meta;
  }

  meta(socket: Socket) {
    return this.sockets.get(socket.id) ?? null;
  }

  onlineUserIds(workspaceId: string) {
    return [...(this.online.get(workspaceId) ?? [])];
  }

  isOnline(workspaceId: string, userId: string) {
    return this.online.get(workspaceId)?.has(userId) ?? false;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToWorkspace(workspaceId: string, event: string, payload: unknown) {
    this.server?.to(`workspace:${workspaceId}`).emit(event, payload);
  }

  emitToConversation(conversationId: string, event: string, payload: unknown) {
    this.server?.to(`conversation:${conversationId}`).emit(event, payload);
  }

  emitToTask(taskId: string, event: string, payload: unknown) {
    this.server?.to(`task:${taskId}`).emit(event, payload);
  }
}
