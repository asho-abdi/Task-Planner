import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  NotificationType,
  Prisma,
  TeamMemberRole,
  Workspace,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateWorkspaceDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITABLE_ROLES: WorkspaceRole[] = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
];

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.WorkspaceInvitationSelect;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    const slug = await this.uniqueSlug(dto.name);
    return this.prisma.workspace.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || undefined,
        logo: dto.logo?.trim() || undefined,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: WorkspaceRole.OWNER,
            status: WorkspaceMemberStatus.ACTIVE,
          },
        },
        teams: {
          create: {
            name: 'General',
            ownerId: userId,
            members: {
              create: { userId, role: TeamMemberRole.ADMIN },
            },
          },
        },
      },
    });
  }

  async listForUser(userId: string) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        members: {
          some: { userId, status: WorkspaceMemberStatus.ACTIVE },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo: true,
        createdAt: true,
        updatedAt: true,
        members: {
          where: { userId, status: WorkspaceMemberStatus.ACTIVE },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workspaces.map(({ members, ...workspace }) => ({
      ...workspace,
      role: members[0]?.role ?? WorkspaceRole.VIEWER,
    }));
  }

  async findByIdForUser(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        members: { some: { userId, status: WorkspaceMemberStatus.ACTIVE } },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto) {
    try {
      return await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.logo !== undefined ? { logo: dto.logo } : {}),
          ...(dto.name !== undefined
            ? { slug: await this.uniqueSlug(dto.name, workspaceId) }
            : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logo: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Workspace not found');
      }
      throw error;
    }
  }

  listMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: WorkspaceMemberStatus.ACTIVE },
      select: {
        id: true,
        role: true,
        userId: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateMemberRole(
    workspaceId: string,
    actor: { id: string; role: WorkspaceRole },
    userId: string,
    dto: UpdateMemberRoleDto,
  ) {
    if (actor.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only the workspace owner can change roles');
    }
    if (userId === actor.id) {
      throw new BadRequestException('You cannot change your own role');
    }
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member || member.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('The workspace owner role cannot be changed');
    }
    return this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role: dto.role },
      select: {
        id: true,
        role: true,
        userId: true,
        joinedAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async removeMember(
    workspaceId: string,
    actor: { id: string; role: WorkspaceRole },
    userId: string,
  ) {
    if (actor.role !== WorkspaceRole.OWNER && actor.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }
    if (userId === actor.id) {
      throw new BadRequestException('You cannot remove yourself');
    }
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member || member.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('The workspace owner cannot be removed');
    }
    if (
      actor.role === WorkspaceRole.ADMIN &&
      member.role !== WorkspaceRole.MEMBER &&
      member.role !== WorkspaceRole.VIEWER
    ) {
      throw new ForbiddenException('Admins can only remove members and viewers');
    }
    await this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { status: WorkspaceMemberStatus.SUSPENDED },
    });
  }

  listInvitations(workspaceId: string) {
    return this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: InvitationStatus.PENDING },
      select: invitationSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  listMyInvitations(email: string) {
    return this.prisma.workspaceInvitation.findMany({
      where: {
        email: email.toLowerCase(),
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: {
        ...invitationSelect,
        workspace: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async previewInvitation(token: string) {
    const invitation = await this.requirePendingInvitationByToken(token, false);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: invitation.workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new NotFoundException('Invitation not found');
    }
    return {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      workspace,
    };
  }

  async invite(
    workspaceId: string,
    invitedById: string,
    inviterRole: WorkspaceRole,
    dto: InviteMemberDto,
  ) {
    if (!INVITABLE_ROLES.includes(dto.role)) {
      throw new BadRequestException('Cannot invite a member as OWNER');
    }
    if (
      inviterRole === WorkspaceRole.ADMIN &&
      dto.role === WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Workspace admins can only invite Members or Viewers',
      );
    }

    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      const membership = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
        select: { status: true },
      });
      if (membership?.status === WorkspaceMemberStatus.ACTIVE) {
        throw new ConflictException('User is already a workspace member');
      }
    }

    const duplicate = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'A pending invitation already exists for this email',
      );
    }

    const token = randomBytes(32).toString('hex');
    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role: dto.role,
        invitedById,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        status: InvitationStatus.PENDING,
      },
      select: invitationSelect,
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const origin =
      this.config.get<string>('frontendUrl') ?? 'http://localhost:3000';
    const inviteUrl = `${origin}/invite/${token}`;
    await this.mail.send({
      to: email,
      subject: `Invitation to ${workspace?.name ?? 'a workspace'}`,
      text: `You were invited to join ${workspace?.name ?? 'a workspace'} as ${dto.role.toLowerCase()}. Open ${inviteUrl} to accept. This link expires in 7 days.`,
    });

    if (existingUser) {
      await this.notifications.notify({
        workspaceId,
        userIds: [existingUser.id],
        type: NotificationType.WORKSPACE_INVITE,
        title: 'Workspace invitation',
        message: `You were invited to join ${workspace?.name ?? 'a workspace'}.`,
        entityId: invitation.id,
        entityType: 'invitation',
      });
    }

    return { invitation, token };
  }

  async resendInvitation(
    workspaceId: string,
    invitationId: string,
  ) {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId,
        status: InvitationStatus.PENDING,
      },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const token = randomBytes(32).toString('hex');
    const updated = await this.prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: invitationSelect,
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const origin =
      this.config.get<string>('frontendUrl') ?? 'http://localhost:3000';
    await this.mail.send({
      to: invitation.email,
      subject: `Invitation to ${workspace?.name ?? 'a workspace'}`,
      text: `You were invited to join ${workspace?.name ?? 'a workspace'}. Open ${origin}/invite/${token} to accept. This link expires in 7 days.`,
    });

    return { invitation: updated, token };
  }

  async revokeInvitation(workspaceId: string, invitationId: string) {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId,
        status: InvitationStatus.PENDING,
      },
      select: { id: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REVOKED, respondedAt: new Date() },
    });
  }

  async acceptInvitation(userId: string, userEmail: string, token: string) {
    const invitation = await this.requirePendingInvitationByToken(token, true);
    this.assertInviteEmail(invitation.email, userEmail);
    return this.activateInvitation(userId, invitation);
  }

  async acceptMyInvitation(
    userId: string,
    userEmail: string,
    invitationId: string,
  ) {
    const invitation = await this.requirePendingInvitationById(invitationId);
    this.assertInviteEmail(invitation.email, userEmail);
    return this.activateInvitation(userId, invitation);
  }

  async declineInvitation(
    userEmail: string,
    input: { token?: string; invitationId?: string },
  ) {
    const invitation = input.token
      ? await this.requirePendingInvitationByToken(input.token, true)
      : input.invitationId
        ? await this.requirePendingInvitationById(input.invitationId)
        : null;
    if (!invitation) {
      throw new BadRequestException('Invitation token or id is required');
    }
    this.assertInviteEmail(invitation.email, userEmail);
    await this.prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.DECLINED,
        respondedAt: new Date(),
      },
    });
    return { declined: true };
  }

  private async activateInvitation(
    userId: string,
    invitation: {
      id: string;
      workspaceId: string;
      role: WorkspaceRole;
      createdAt: Date;
    },
  ) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          status: WorkspaceMemberStatus.ACTIVE,
          invitedAt: invitation.createdAt,
        },
        update: {
          role: invitation.role,
          status: WorkspaceMemberStatus.ACTIVE,
        },
      }),
      this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: now,
          respondedAt: now,
        },
      }),
    ]);

    return { workspaceId: invitation.workspaceId };
  }

  private assertInviteEmail(invitedEmail: string, userEmail: string) {
    if (invitedEmail !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email',
      );
    }
  }

  private async requirePendingInvitationByToken(
    token: string,
    expireIfStale: boolean,
  ) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      if (expireIfStale) {
        await this.prisma.workspaceInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED, respondedAt: new Date() },
        });
      }
      throw new BadRequestException('Invitation has expired');
    }
    return invitation;
  }

  private async requirePendingInvitationById(invitationId: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED, respondedAt: new Date() },
      });
      throw new BadRequestException('Invitation has expired');
    }
    return invitation;
  }

  private async uniqueSlug(name: string, excludeId?: string) {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'workspace';
    let slug = base;
    let n = 0;
    while (true) {
      const existing = await this.prisma.workspace.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) {
        return slug;
      }
      n += 1;
      slug = `${base}-${n}`;
    }
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
