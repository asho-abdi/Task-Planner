import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ChatKind, ChatPrivacy, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { ChatService } from './chat.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';

const member: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.MEMBER,
};

describe('ChatService', () => {
  let service: ChatService;
  const prisma = {
    chatConversation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
    chatMember: { upsert: jest.fn() },
    workspaceMember: { findMany: jest.fn() },
    team: { findFirst: jest.fn() },
  };
  const projects = { resolveAccess: jest.fn() };
  const notifications = { notify: jest.fn() };
  const tasks = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projects },
        { provide: NotificationsService, useValue: notifications },
        { provide: TasksService, useValue: tasks },
      ],
    }).compile();
    service = module.get(ChatService);
  });

  it('hides private channels from non-members', async () => {
    prisma.chatConversation.findMany
      .mockResolvedValueOnce([
        { name: 'general' },
        { name: 'development' },
        { name: 'marketing' },
        { name: 'announcements' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'c-1',
          workspaceId: 'ws-1',
          kind: ChatKind.CHANNEL,
          name: 'secret',
          description: null,
          privacy: ChatPrivacy.PRIVATE,
          teamId: null,
          projectId: null,
          lastMessageAt: null,
          team: null,
          project: null,
          members: [
            {
              userId: 'other',
              lastReadAt: null,
              user: { id: 'other', name: 'Ali', email: 'a@x', lastSeenAt: null },
            },
          ],
          messages: [],
        },
      ]);
    prisma.chatMessage.count.mockResolvedValue(0);
    const result = await service.listConversations(member, 'user-1');
    expect(result).toEqual([]);
  });

  it('rejects a direct message to a non-member', async () => {
    prisma.workspaceMember.findMany.mockResolvedValue([]);
    await expect(
      service.openDirect(member, 'user-1', 'outsider'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
