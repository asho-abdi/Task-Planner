import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  TaskStatus,
  TeamMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCanMutate,
  canAdminister,
} from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import {
  AddTeamMemberDto,
  CreateTeamDto,
  UpdateTeamDto,
  UpdateTeamMemberDto,
} from './dto/team.dto';
import { NotificationsService } from '../notifications/notifications.service';

const teamSelect = {
  id: true,
  name: true,
  description: true,
  icon: true,
  ownerId: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  members: {
    select: {
      id: true,
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { projects: true, members: true } },
} satisfies Prisma.TeamSelect;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(membership: WorkspaceMembershipContext) {
    const teams = await this.prisma.team.findMany({
      where: { workspaceId: membership.workspaceId },
      select: teamSelect,
      orderBy: { createdAt: 'asc' },
    });
    return this.withActiveTaskCounts(membership.workspaceId, teams);
  }

  async findById(membership: WorkspaceMembershipContext, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, workspaceId: membership.workspaceId },
      select: teamSelect,
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const [withCounts] = await this.withActiveTaskCounts(
      membership.workspaceId,
      [team],
    );
    return withCounts;
  }

  async create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateTeamDto,
  ) {
    assertCanMutate(membership);
    const team = await this.prisma.team.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || null,
        workspaceId: membership.workspaceId,
        ownerId: userId,
        members: {
          create: {
            userId,
            workspaceId: membership.workspaceId,
            role: TeamMemberRole.ADMIN,
          },
        },
      },
      select: teamSelect,
    });
    const [withCounts] = await this.withActiveTaskCounts(
      membership.workspaceId,
      [team],
    );
    return withCounts;
  }

  async update(
    membership: WorkspaceMembershipContext,
    userId: string,
    teamId: string,
    dto: UpdateTeamDto,
  ) {
    const team = await this.requireTeam(membership.workspaceId, teamId);
    await this.assertCanManageTeam(membership, userId, team.id, team.ownerId);
    const updated = await this.prisma.team.update({
      where: { id: team.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
      },
      select: teamSelect,
    });
    const [withCounts] = await this.withActiveTaskCounts(
      membership.workspaceId,
      [updated],
    );
    return withCounts;
  }

  async addMember(
    membership: WorkspaceMembershipContext,
    actorId: string,
    teamId: string,
    dto: AddTeamMemberDto,
  ) {
    const team = await this.requireTeam(membership.workspaceId, teamId);
    await this.assertCanManageTeam(membership, actorId, team.id, team.ownerId);
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId: dto.userId,
        },
      },
      select: { status: true },
    });
    if (!member || member.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new BadRequestException('User must be an active workspace member');
    }

    await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: dto.userId } },
      create: {
        teamId: team.id,
        userId: dto.userId,
        workspaceId: membership.workspaceId,
        role: dto.role ?? TeamMemberRole.MEMBER,
      },
      update: {
        role: dto.role ?? TeamMemberRole.MEMBER,
      },
    });

    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: [dto.userId],
      type: NotificationType.TEAM_INVITE,
      title: `Added to ${team.name}`,
      message: `You were added to the ${team.name} team.`,
      entityId: team.id,
      entityType: 'team',
    });

    return this.findById(membership, team.id);
  }

  async updateMemberRole(
    membership: WorkspaceMembershipContext,
    actorId: string,
    teamId: string,
    userId: string,
    dto: UpdateTeamMemberDto,
  ) {
    const team = await this.requireTeam(membership.workspaceId, teamId);
    await this.assertCanManageTeam(membership, actorId, team.id, team.ownerId);
    if (userId === team.ownerId && dto.role !== TeamMemberRole.ADMIN) {
      throw new BadRequestException('The team creator stays a team admin');
    }
    await this.prisma.teamMember.updateMany({
      where: {
        teamId: team.id,
        userId,
        workspaceId: membership.workspaceId,
      },
      data: { role: dto.role },
    });
    return this.findById(membership, team.id);
  }

  async removeMember(
    membership: WorkspaceMembershipContext,
    actorId: string,
    teamId: string,
    userId: string,
  ) {
    const team = await this.requireTeam(membership.workspaceId, teamId);
    await this.assertCanManageTeam(membership, actorId, team.id, team.ownerId);
    if (userId === team.ownerId) {
      throw new BadRequestException('The team creator cannot be removed');
    }
    await this.prisma.teamMember.deleteMany({
      where: {
        teamId: team.id,
        userId,
        workspaceId: membership.workspaceId,
      },
    });
    return this.findById(membership, team.id);
  }

  private async assertCanManageTeam(
    membership: WorkspaceMembershipContext,
    actorId: string,
    teamId: string,
    ownerId: string,
  ) {
    if (canAdminister(membership.role) || actorId === ownerId) {
      return;
    }
    const membershipRow = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: actorId } },
      select: { role: true },
    });
    if (membershipRow?.role === TeamMemberRole.ADMIN) {
      return;
    }
    throw new ForbiddenException('Only team admins can manage this team');
  }

  private async requireTeam(workspaceId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, workspaceId },
      select: { id: true, name: true, ownerId: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  private async withActiveTaskCounts(
    workspaceId: string,
    teams: Array<Prisma.TeamGetPayload<{ select: typeof teamSelect }>>,
  ) {
    if (!teams.length) {
      return teams.map((team) => ({
        ...team,
        createdBy: team.owner,
        activeTaskCount: 0,
      }));
    }
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        teamId: { in: teams.map((team) => team.id) },
      },
      select: {
        teamId: true,
        _count: {
          select: {
            tasks: {
              where: {
                status: { notIn: [TaskStatus.COMPLETED, TaskStatus.ARCHIVED] },
              },
            },
          },
        },
      },
    });
    const counts = new Map<string, number>();
    for (const project of projects) {
      if (!project.teamId) {
        continue;
      }
      counts.set(
        project.teamId,
        (counts.get(project.teamId) ?? 0) + project._count.tasks,
      );
    }
    return teams.map((team) => ({
      ...team,
      createdBy: team.owner,
      activeTaskCount: counts.get(team.id) ?? 0,
    }));
  }
}
