import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  TaskVisibility,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

type HandshakeAuth = {
  token?: string;
  workspaceId?: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
  }

  async handleConnection(socket: Socket) {
    const auth = (socket.handshake.auth ?? {}) as HandshakeAuth;
    const header = socket.handshake.headers.authorization;
    const token =
      auth.token ??
      (typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : undefined) ??
      (typeof socket.handshake.query.token === 'string'
        ? socket.handshake.query.token
        : undefined);
    const workspaceId =
      auth.workspaceId ??
      (typeof socket.handshake.query.workspaceId === 'string'
        ? socket.handshake.query.workspaceId
        : undefined);
    if (!token || !workspaceId) {
      socket.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const membership = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: payload.sub },
        },
        select: { status: true },
      });
      if (!membership || membership.status !== WorkspaceMemberStatus.ACTIVE) {
        socket.disconnect(true);
        return;
      }
      this.realtime.register(socket, { userId: payload.sub, workspaceId });
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { lastSeenAt: new Date() },
      });
      this.realtime.emitToWorkspace(workspaceId, 'presence', {
        userId: payload.sub,
        status: 'ONLINE',
        onlineUserIds: this.realtime.onlineUserIds(workspaceId),
      });
    } catch (error) {
      this.logger.debug(
        `Socket auth failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const left = this.realtime.unregister(socket);
    if (!left) {
      return;
    }
    await this.prisma.user.update({
      where: { id: left.userId },
      data: { lastSeenAt: new Date() },
    });
    this.realtime.emitToWorkspace(left.workspaceId, 'presence', {
      userId: left.userId,
      status: 'OFFLINE',
      lastSeenAt: new Date().toISOString(),
      onlineUserIds: this.realtime.onlineUserIds(left.workspaceId),
    });
  }

  @SubscribeMessage('join:conversation')
  async joinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const meta = this.realtime.meta(socket);
    if (!meta || !body?.conversationId) {
      return;
    }
    const allowed = await this.canAccessConversation(
      meta.workspaceId,
      meta.userId,
      body.conversationId,
    );
    if (allowed) {
      await socket.join(`conversation:${body.conversationId}`);
    }
  }

  @SubscribeMessage('leave:conversation')
  leaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (body?.conversationId) {
      void socket.leave(`conversation:${body.conversationId}`);
    }
  }

  @SubscribeMessage('join:task')
  async joinTask(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { taskId?: string },
  ) {
    const meta = this.realtime.meta(socket);
    if (!meta || !body?.taskId) {
      return;
    }
    const allowed = await this.canAccessTask(
      meta.workspaceId,
      meta.userId,
      body.taskId,
    );
    if (allowed) {
      await socket.join(`task:${body.taskId}`);
    }
  }

  @SubscribeMessage('leave:task')
  leaveTask(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { taskId?: string },
  ) {
    if (body?.taskId) {
      void socket.leave(`task:${body.taskId}`);
    }
  }

  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId?: string; typing?: boolean },
  ) {
    const meta = this.realtime.meta(socket);
    if (!meta || !body?.conversationId) {
      return;
    }
    this.realtime.emitToConversation(body.conversationId, 'typing', {
      conversationId: body.conversationId,
      userId: meta.userId,
      typing: Boolean(body.typing),
    });
  }

  private async canAccessConversation(
    workspaceId: string,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, workspaceId },
      select: {
        privacy: true,
        kind: true,
        members: { where: { userId }, select: { id: true } },
      },
    });
    if (!conversation) {
      return false;
    }
    if (conversation.privacy === 'PUBLIC' && conversation.kind === 'CHANNEL') {
      return true;
    }
    return conversation.members.length > 0;
  }

  private async canAccessTask(
    workspaceId: string,
    userId: string,
    taskId: string,
  ) {
    const [task, membership] = await Promise.all([
      this.prisma.task.findFirst({
        where: { id: taskId, workspaceId },
        select: {
          visibility: true,
          ownerId: true,
          assignedById: true,
          assignees: { where: { userId }, select: { id: true } },
          shares: { where: { userId }, select: { id: true } },
        },
      }),
      this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      }),
    ]);
    if (!task || !membership) {
      return false;
    }
    if (task.visibility !== TaskVisibility.PRIVATE) {
      return true;
    }
    if (
      membership.role === WorkspaceRole.OWNER ||
      membership.role === WorkspaceRole.ADMIN
    ) {
      return true;
    }
    return (
      task.ownerId === userId ||
      task.assignedById === userId ||
      task.assignees.length > 0 ||
      task.shares.length > 0
    );
  }
}
