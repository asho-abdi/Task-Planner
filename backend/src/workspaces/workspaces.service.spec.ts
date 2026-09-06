import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InvitationStatus,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  const prisma = {
    workspace: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    workspaceMember: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    workspaceInvitation: { create: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { send: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') },
        },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
      ],
    }).compile();
    service = module.get(WorkspacesService);
    prisma.workspace.findFirst.mockResolvedValue(null);
  });

  it('creates a workspace owned by the actor', async () => {
    prisma.workspace.findFirst.mockResolvedValue(null);
    prisma.workspace.create.mockResolvedValue({
      id: 'ws-1',
      name: 'Acme',
      ownerId: 'user-1',
    });

    await service.create('user-1', { name: 'Acme' });

    expect(prisma.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Acme',
          ownerId: 'user-1',
          members: {
            create: expect.objectContaining({
              userId: 'user-1',
              role: WorkspaceRole.OWNER,
              status: WorkspaceMemberStatus.ACTIVE,
            }),
          },
          teams: {
            create: expect.objectContaining({
              name: 'General',
              ownerId: 'user-1',
            }),
          },
        }),
      }),
    );
  });

  it('does not allow inviting someone as OWNER', async () => {
    await expect(
      service.invite('ws-1', 'owner-1', WorkspaceRole.OWNER, {
        email: 'a@b.com',
        role: WorkspaceRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a pending invite for an existing user instead of adding them', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    prisma.workspaceInvitation.findFirst.mockResolvedValue(null);
    prisma.workspaceInvitation.create.mockResolvedValue({
      id: 'inv-1',
      email: 'a@b.com',
      role: WorkspaceRole.MEMBER,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    prisma.workspace.findUnique.mockResolvedValue({ name: 'Acme' });

    const result = await service.invite(
      'ws-1',
      'owner-1',
      WorkspaceRole.OWNER,
      {
        email: 'a@b.com',
        role: WorkspaceRole.MEMBER,
      },
    );

    expect(result.invitation.email).toBe('a@b.com');
    expect(result.token).toHaveLength(64);
    expect(prisma.workspaceInvitation.create).toHaveBeenCalled();
    expect(prisma.workspaceMember.upsert).not.toHaveBeenCalled();
  });

  it('does not let a workspace admin invite another admin', async () => {
    await expect(
      service.invite('ws-1', 'admin-1', WorkspaceRole.ADMIN, {
        email: 'a@b.com',
        role: WorkspaceRole.ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects inviting a user who is already an active member', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'mem-2',
      status: WorkspaceMemberStatus.ACTIVE,
    });

    await expect(
      service.invite('ws-1', 'owner-1', WorkspaceRole.OWNER, {
        email: 'a@b.com',
        role: WorkspaceRole.VIEWER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a pending invitation when the email is unknown', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspaceInvitation.findFirst.mockResolvedValue(null);
    prisma.workspaceInvitation.create.mockResolvedValue({
      id: 'inv-1',
      email: 'new@b.com',
      role: WorkspaceRole.VIEWER,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    prisma.workspace.findUnique.mockResolvedValue({ name: 'Acme' });

    const result = await service.invite(
      'ws-1',
      'owner-1',
      WorkspaceRole.OWNER,
      {
        email: 'new@b.com',
        role: WorkspaceRole.VIEWER,
      },
    );

    expect(result.token).toHaveLength(64);
    expect(prisma.workspaceInvitation.create).toHaveBeenCalled();
  });
});
