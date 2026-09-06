import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ActivityType,
  ChatKind,
  ChatPrivacy,
  NotificationType,
  Prisma,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanMutate, canView } from '../common/permissions';
import { resolveMentionedUserIds } from '../common/mentions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { ActivityService } from '../activity/activity.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  ConvertMessageDto,
  CreateChannelDto,
  SendMessageDto,
} from './dto/chat.dto';

const personSelect = { id: true, name: true, email: true, lastSeenAt: true };

const DEFAULT_CHANNELS = [
  { name: 'general', description: 'Everyone in the workspace' },
  { name: 'development', description: 'Engineering and product work' },
  { name: 'marketing', description: 'Campaigns and go-to-market' },
  { name: 'announcements', description: 'Official workspace updates' },
];

const messageSelect = {
  id: true,
  body: true,
  parentId: true,
  conversationId: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: personSelect },
  reactions: {
    select: { emoji: true, userId: true, user: { select: personSelect } },
  },
  files: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
    },
  },
  task: { select: { id: true, title: true, status: true } },
} satisfies Prisma.ChatMessageSelect;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
    private readonly tasks: TasksService,
    @Optional() private readonly activity?: ActivityService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async listConversations(
    membership: WorkspaceMembershipContext,
    userId: string,
  ) {
    await this.ensureDefaultChannels(membership.workspaceId, userId);
    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        workspaceId: membership.workspaceId,
        OR: [
          { kind: ChatKind.CHANNEL, privacy: ChatPrivacy.PUBLIC },
          { members: { some: { userId } } },
        ],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'asc' }],
      include: {
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        members: {
          select: {
            userId: true,
            lastReadAt: true,
            user: { select: personSelect },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    });

    const visible = [];
    for (const conversation of conversations) {
      if (conversation.kind === ChatKind.PROJECT && conversation.projectId) {
        const access = await this.projects.resolveAccess(
          membership,
          userId,
          conversation.projectId,
        );
        if (!canView(access)) {
          continue;
        }
      }
      if (
        conversation.privacy === ChatPrivacy.PRIVATE &&
        conversation.kind !== ChatKind.CHANNEL
      ) {
        if (!conversation.members.some((item) => item.userId === userId)) {
          continue;
        }
      }
      if (
        conversation.privacy === ChatPrivacy.PRIVATE &&
        conversation.kind === ChatKind.CHANNEL &&
        !conversation.members.some((item) => item.userId === userId)
      ) {
        continue;
      }
      const membershipRow = conversation.members.find(
        (item) => item.userId === userId,
      );
      const unreadCount = await this.prisma.chatMessage.count({
        where: {
          conversationId: conversation.id,
          authorId: { not: userId },
          ...(membershipRow?.lastReadAt
            ? { createdAt: { gt: membershipRow.lastReadAt } }
            : {}),
        },
      });
      visible.push(this.toConversation(conversation, userId, unreadCount));
    }
    return visible;
  }

  async createChannel(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateChannelDto,
  ) {
    assertCanMutate(membership);
    const name = this.normalizeChannelName(dto.name);
    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: dto.teamId, workspaceId: membership.workspaceId },
        select: { id: true },
      });
      if (!team) {
        throw new BadRequestException('Team not found in this workspace');
      }
    }
    const privacy = dto.privacy ?? ChatPrivacy.PUBLIC;
    const memberIds = [
      ...new Set([userId, ...(dto.memberIds ?? [])].filter(Boolean)),
    ];
    await this.assertActiveMembers(membership.workspaceId, memberIds);
    try {
      const conversation = await this.prisma.chatConversation.create({
        data: {
          workspaceId: membership.workspaceId,
          kind: ChatKind.CHANNEL,
          name,
          description: dto.description?.trim() || null,
          privacy,
          teamId: dto.teamId ?? null,
          createdById: userId,
          members: {
            create: memberIds.map((id) => ({ userId: id })),
          },
        },
      });
      await this.activity?.log({
        workspaceId: membership.workspaceId,
        actorId: userId,
        type: ActivityType.CHANNEL_CREATED,
        title: `created #${name}`,
        entityType: 'conversation',
        entityId: conversation.id,
      });
      return this.getConversation(membership, userId, conversation.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('A channel with that name already exists');
      }
      throw error;
    }
  }

  async openDirect(
    membership: WorkspaceMembershipContext,
    userId: string,
    otherUserId: string,
  ) {
    assertCanMutate(membership);
    if (otherUserId === userId) {
      throw new BadRequestException('Choose another person for a direct message');
    }
    await this.assertActiveMembers(membership.workspaceId, [otherUserId]);
    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        kind: ChatKind.DIRECT,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      select: { id: true, members: { select: { userId: true } } },
    });
    if (existing && existing.members.length <= 2) {
      return this.getConversation(membership, userId, existing.id);
    }
    const conversation = await this.prisma.chatConversation.create({
      data: {
        workspaceId: membership.workspaceId,
        kind: ChatKind.DIRECT,
        privacy: ChatPrivacy.PRIVATE,
        createdById: userId,
        members: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
    });
    return this.getConversation(membership, userId, conversation.id);
  }

  async projectConversation(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
  ) {
    const access = await this.projects.resolveAccess(
      membership,
      userId,
      projectId,
    );
    if (!canView(access)) {
      throw new ForbiddenException('You cannot access this project chat');
    }
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId: membership.workspaceId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        teamId: true,
        assignments: { select: { userId: true } },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const existing = await this.prisma.chatConversation.findFirst({
      where: { projectId, workspaceId: membership.workspaceId },
      select: { id: true },
    });
    if (existing) {
      return this.getConversation(membership, userId, existing.id);
    }
    const memberIds = [
      ...new Set(
        [project.ownerId, userId, ...project.assignments.map((item) => item.userId)],
      ),
    ];
    const conversation = await this.prisma.chatConversation.create({
      data: {
        workspaceId: membership.workspaceId,
        kind: ChatKind.PROJECT,
        name: project.name,
        description: `Project chat for ${project.name}`,
        privacy: ChatPrivacy.PRIVATE,
        projectId,
        teamId: project.teamId,
        createdById: userId,
        members: {
          create: memberIds.map((id) => ({ userId: id })),
        },
      },
    });
    return this.getConversation(membership, userId, conversation.id);
  }

  async getConversation(
    membership: WorkspaceMembershipContext,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.requireConversation(
      membership,
      userId,
      conversationId,
    );
    const membershipRow = conversation.members.find(
      (item) => item.userId === userId,
    );
    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        conversationId,
        authorId: { not: userId },
        ...(membershipRow?.lastReadAt
          ? { createdAt: { gt: membershipRow.lastReadAt } }
          : {}),
      },
    });
    return this.toConversation(conversation, userId, unreadCount);
  }

  async listMessages(
    membership: WorkspaceMembershipContext,
    userId: string,
    conversationId: string,
    query: { take?: number; before?: string },
  ) {
    await this.requireConversation(membership, userId, conversationId);
    const take = Math.min(Math.max(query.take ?? 50, 1), 100);
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        workspaceId: membership.workspaceId,
        ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: messageSelect,
    });
    return messages.reverse().map((item) => this.toMessage(item));
  }

  async sendMessage(
    membership: WorkspaceMembershipContext,
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    assertCanMutate(membership);
    const conversation = await this.requireConversation(
      membership,
      userId,
      conversationId,
    );
    if (dto.parentId) {
      const parent = await this.prisma.chatMessage.findFirst({
        where: { id: dto.parentId, conversationId },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('Reply target not found');
      }
    }
    const message = await this.prisma.chatMessage.create({
      data: {
        workspaceId: membership.workspaceId,
        conversationId,
        authorId: userId,
        body: dto.body.trim(),
        parentId: dto.parentId ?? null,
      },
      select: messageSelect,
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    await this.prisma.chatMember.upsert({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      create: { conversationId, userId, lastReadAt: message.createdAt },
      update: { lastReadAt: message.createdAt },
    });

    const mapped = this.toMessage(message);
    this.realtime?.emitToConversation(conversationId, 'message:new', mapped);

    const members = await this.workspacePeople(membership.workspaceId);
    const mentioned = resolveMentionedUserIds(dto.body, members).filter(
      (id) => id !== userId,
    );
    const authorName =
      members.find((item) => item.id === userId)?.name ?? 'Someone';
    const channelLabel =
      conversation.kind === ChatKind.CHANNEL
        ? `#${conversation.name}`
        : conversation.kind === ChatKind.PROJECT
          ? conversation.project?.name ?? 'project chat'
          : 'a direct message';
    if (mentioned.length) {
      await this.notifications.notify({
        workspaceId: membership.workspaceId,
        userIds: mentioned,
        type: NotificationType.MENTION,
        title: 'You were mentioned',
        message: `${authorName} mentioned you in ${channelLabel}`,
        entityId: conversationId,
        entityType: 'conversation',
      });
    }
    const notifyIds = conversation.members
      .map((item) => item.userId)
      .filter((id) => id !== userId && !mentioned.includes(id));
    if (conversation.kind === ChatKind.DIRECT && notifyIds.length) {
      await this.notifications.notify({
        workspaceId: membership.workspaceId,
        userIds: notifyIds,
        type: NotificationType.MENTION,
        title: 'New message',
        message: `${authorName} sent you a message`,
        entityId: conversationId,
        entityType: 'conversation',
      });
    }
    return mapped;
  }

  async react(
    membership: WorkspaceMembershipContext,
    userId: string,
    messageId: string,
    emoji: string,
  ) {
    assertCanMutate(membership);
    const message = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, workspaceId: membership.workspaceId },
      select: { id: true, conversationId: true },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    await this.requireConversation(membership, userId, message.conversationId);
    const existing = await this.prisma.chatReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
    });
    if (existing) {
      await this.prisma.chatReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.chatReaction.create({
        data: { messageId, userId, emoji },
      });
    }
    const updated = await this.prisma.chatMessage.findFirstOrThrow({
      where: { id: messageId },
      select: messageSelect,
    });
    const mapped = this.toMessage(updated);
    this.realtime?.emitToConversation(
      message.conversationId,
      'message:reaction',
      mapped,
    );
    return mapped;
  }

  async markRead(
    membership: WorkspaceMembershipContext,
    userId: string,
    conversationId: string,
  ) {
    await this.requireConversation(membership, userId, conversationId);
    const now = new Date();
    await this.prisma.chatMember.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, lastReadAt: now },
      update: { lastReadAt: now },
    });
    this.realtime?.emitToConversation(conversationId, 'message:read', {
      conversationId,
      userId,
      lastReadAt: now.toISOString(),
    });
    return { ok: true };
  }

  async convertToTask(
    membership: WorkspaceMembershipContext,
    userId: string,
    messageId: string,
    dto: ConvertMessageDto,
  ) {
    assertCanMutate(membership);
    const message = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, workspaceId: membership.workspaceId },
      select: {
        id: true,
        body: true,
        conversationId: true,
        task: { select: { id: true } },
      },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    await this.requireConversation(membership, userId, message.conversationId);
    if (message.task) {
      throw new BadRequestException('This message already has a task');
    }
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: message.conversationId },
      select: { projectId: true },
    });
    const task = await this.tasks.create(membership, userId, {
      title: (dto.title?.trim() || message.body).slice(0, 200),
      description: `Created from chat message`,
      assigneeId: dto.assigneeId,
      projectId: dto.projectId ?? conversation?.projectId ?? undefined,
      priority: dto.priority,
      dueDate: dto.dueDate,
    });
    await this.prisma.task.update({
      where: { id: task.id },
      data: { chatMessageId: message.id },
    });
    const updated = await this.prisma.chatMessage.findFirstOrThrow({
      where: { id: message.id },
      select: messageSelect,
    });
    const mapped = this.toMessage(updated);
    this.realtime?.emitToConversation(
      message.conversationId,
      'message:updated',
      mapped,
    );
    return mapped;
  }

  async canAccess(
    workspaceId: string,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, workspaceId },
      select: {
        privacy: true,
        kind: true,
        projectId: true,
        members: { where: { userId }, select: { id: true } },
      },
    });
    if (!conversation) {
      return false;
    }
    if (conversation.privacy === ChatPrivacy.PUBLIC && conversation.kind === ChatKind.CHANNEL) {
      return true;
    }
    return conversation.members.length > 0;
  }

  private async ensureDefaultChannels(workspaceId: string, userId: string) {
    const existing = await this.prisma.chatConversation.findMany({
      where: { workspaceId, kind: ChatKind.CHANNEL },
      select: { name: true },
    });
    const names = new Set(existing.map((item) => item.name));
    for (const channel of DEFAULT_CHANNELS) {
      if (names.has(channel.name)) {
        continue;
      }
      await this.prisma.chatConversation.create({
        data: {
          workspaceId,
          kind: ChatKind.CHANNEL,
          name: channel.name,
          description: channel.description,
          privacy: ChatPrivacy.PUBLIC,
          members: { create: { userId } },
        },
      });
    }
  }

  private async requireConversation(
    membership: WorkspaceMembershipContext,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, workspaceId: membership.workspaceId },
      include: {
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        members: {
          select: {
            userId: true,
            lastReadAt: true,
            user: { select: personSelect },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.kind === ChatKind.PROJECT && conversation.projectId) {
      const access = await this.projects.resolveAccess(
        membership,
        userId,
        conversation.projectId,
      );
      if (!canView(access)) {
        throw new ForbiddenException('You cannot access this project chat');
      }
      return conversation;
    }
    const isMember = conversation.members.some((item) => item.userId === userId);
    if (
      conversation.privacy === ChatPrivacy.PRIVATE &&
      !isMember
    ) {
      throw new ForbiddenException('You cannot access this conversation');
    }
    if (conversation.kind === ChatKind.DIRECT && !isMember) {
      throw new ForbiddenException('You cannot access this conversation');
    }
    return conversation;
  }

  private async assertActiveMembers(workspaceId: string, userIds: string[]) {
    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: userIds },
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { userId: true },
    });
    if (members.length !== userIds.length) {
      throw new BadRequestException('All participants must be workspace members');
    }
  }

  private async workspacePeople(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: WorkspaceMemberStatus.ACTIVE },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    return members.map((item) => item.user);
  }

  private normalizeChannelName(name: string) {
    return name.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
  }

  private toConversation(
    conversation: {
      id: string;
      kind: ChatKind;
      name: string | null;
      description: string | null;
      privacy: ChatPrivacy;
      teamId: string | null;
      projectId: string | null;
      lastMessageAt: Date | null;
      workspaceId: string;
      team: { id: string; name: string } | null;
      project: { id: string; name: string } | null;
      members: Array<{
        userId: string;
        lastReadAt: Date | null;
        user: {
          id: string;
          name: string;
          email: string;
          lastSeenAt: Date | null;
        };
      }>;
      messages: Array<{
        id: string;
        body: string;
        createdAt: Date;
        author: { id: string; name: string };
      }>;
    },
    userId: string,
    unreadCount: number,
  ) {
    const online = new Set(
      this.realtime?.onlineUserIds(conversation.workspaceId) ?? [],
    );
    return {
      id: conversation.id,
      kind: conversation.kind,
      name: conversation.name,
      description: conversation.description,
      privacy: conversation.privacy,
      teamId: conversation.teamId,
      projectId: conversation.projectId,
      team: conversation.team,
      project: conversation.project,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      lastMessage: conversation.messages[0]
        ? {
            id: conversation.messages[0].id,
            body: conversation.messages[0].body,
            createdAt: conversation.messages[0].createdAt.toISOString(),
            author: conversation.messages[0].author,
          }
        : null,
      unreadCount,
      members: conversation.members.map((item) => ({
        userId: item.userId,
        lastReadAt: item.lastReadAt?.toISOString() ?? null,
        lastSeenAt: item.user.lastSeenAt?.toISOString() ?? null,
        online: online.has(item.userId),
        user: {
          id: item.user.id,
          name: item.user.name,
          email: item.user.email,
        },
      })),
    };
  }

  private toMessage(
    message: Prisma.ChatMessageGetPayload<{ select: typeof messageSelect }>,
  ) {
    const grouped = new Map<string, string[]>();
    for (const reaction of message.reactions) {
      grouped.set(reaction.emoji, [
        ...(grouped.get(reaction.emoji) ?? []),
        reaction.userId,
      ]);
    }
    return {
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
      parentId: message.parentId,
      createdAt: message.createdAt.toISOString(),
      author: {
        id: message.author.id,
        name: message.author.name,
        email: message.author.email,
      },
      reactions: [...grouped.entries()].map(([emoji, userIds]) => ({
        emoji,
        userIds,
        count: userIds.length,
      })),
      files: message.files,
      task: message.task,
    };
  }
}
