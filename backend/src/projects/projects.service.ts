import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentStatus,
  DependencyType,
  NotificationType,
  Prisma,
  Priority,
  ProjectMemberRole,
  ProjectStatus,
  TaskStatus,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  accessFromProjectRole,
  accessFromWorkspaceRole,
  assertCanAdminister,
  assertCanManageProject,
  assertCanMutate,
  canAdminister,
  canEditWork,
  canView,
  higherAccess,
  type ProjectAccessLevel,
} from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AssignProjectDto,
  CreateFromTemplateDto,
  CreateProjectDto,
  ListProjectsQueryDto,
  MilestoneWriteDto,
  SaveTemplateDto,
  UpdateProjectDto,
  UpdateProjectMemberDto,
} from './dto/project.dto';
import {
  BUILTIN_TEMPLATES,
  type TemplatePayload,
} from './project-templates';
import { minutesFromHours } from '../reports/scoring';

const projectSelect = {
  id: true,
  name: true,
  description: true,
  icon: true,
  status: true,
  priority: true,
  startDate: true,
  endDate: true,
  workspaceId: true,
  ownerId: true,
  teamId: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: { id: true, name: true, email: true },
  },
  team: {
    select: { id: true, name: true, icon: true },
  },
  assignments: {
    select: {
      id: true,
      userId: true,
      status: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      tasks: true,
      assignments: true,
    },
  },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    membership: WorkspaceMembershipContext,
    query: ListProjectsQueryDto,
    userId: string,
  ) {
    const where: Prisma.ProjectWhereInput = {
      workspaceId: membership.workspaceId,
    };

    if (query.status) {
      where.status = query.status;
    } else if (!query.includeArchived) {
      where.status = { not: ProjectStatus.ARCHIVED };
    }

    const projects = await this.prisma.project.findMany({
      where,
      select: projectSelect,
      orderBy: { updatedAt: 'desc' },
    });
    const synced = await this.applyDerivedStatuses(
      membership.workspaceId,
      projects,
    );
    return Promise.all(
      synced.map((project) => this.toHub(membership, userId, project)),
    );
  }

  async findById(
    membership: WorkspaceMembershipContext,
    projectId: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId: membership.workspaceId },
      select: projectSelect,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const [synced] = await this.applyDerivedStatuses(membership.workspaceId, [
      project,
    ]);
    return this.toHub(membership, userId, synced);
  }

  async syncDerivedStatus(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: projectSelect,
    });
    if (!project) {
      return;
    }
    await this.applyDerivedStatuses(workspaceId, [project]);
  }

  async create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateProjectDto,
  ) {
    assertCanMutate(membership);
    this.assertDates(dto.startDate, dto.endDate ?? dto.dueDate);

    const teamId = dto.teamId
      ? await this.assertTeamInWorkspace(membership.workspaceId, dto.teamId)
      : await this.ensureDefaultTeam(membership.workspaceId, userId);

    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : dto.dueDate
        ? new Date(dto.dueDate)
        : null;
    const created = await this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || null,
        status: deriveProjectStatus({
          currentStatus: ProjectStatus.PLANNING,
          startDate,
          taskCounts: {},
        }),
        priority: dto.priority,
        startDate,
        endDate,
        workspaceId: membership.workspaceId,
        ownerId: userId,
        teamId,
        assignments: {
          create: {
            workspaceId: membership.workspaceId,
            userId,
            role: ProjectMemberRole.OWNER,
            status: AssignmentStatus.COMPLETED,
          },
        },
      },
      select: projectSelect,
    });
    return this.toHub(membership, userId, created);
  }

  async update(
    membership: WorkspaceMembershipContext,
    projectId: string,
    dto: UpdateProjectDto,
    userId: string,
  ) {
    assertCanMutate(membership);
    const project = await this.requireProject(
      membership.workspaceId,
      projectId,
    );
    const access = await this.resolveAccess(membership, userId, project.id);
    assertCanManageProject(access);
    const endDate =
      dto.endDate !== undefined
        ? dto.endDate
        : dto.dueDate !== undefined
          ? dto.dueDate
          : project.endDate?.toISOString();
    this.assertDates(
      dto.startDate === undefined
        ? project.startDate?.toISOString()
        : dto.startDate,
      endDate,
    );

    let nextStatus: ProjectStatus | undefined;
    if (dto.status === ProjectStatus.ON_HOLD) {
      nextStatus = ProjectStatus.ON_HOLD;
    } else if (
      dto.status &&
      dto.status !== ProjectStatus.ARCHIVED &&
      project.status === ProjectStatus.ON_HOLD
    ) {
      nextStatus = ProjectStatus.PLANNING;
    }

    if (dto.teamId) {
      await this.assertTeamInWorkspace(membership.workspaceId, dto.teamId);
    }

    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : dto.dueDate !== undefined
            ? { endDate: dto.dueDate ? new Date(dto.dueDate) : null }
            : {}),
        ...(dto.teamId !== undefined ? { teamId: dto.teamId || null } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
      },
      select: projectSelect,
    });
    const [synced] = await this.applyDerivedStatuses(
      membership.workspaceId,
      [updated],
    );
    return this.toHub(membership, userId, synced);
  }

  async archive(
    membership: WorkspaceMembershipContext,
    projectId: string,
    userId: string,
  ) {
    assertCanMutate(membership);
    const project = await this.requireProject(
      membership.workspaceId,
      projectId,
    );
    const access = await this.resolveAccess(membership, userId, project.id);
    assertCanManageProject(access);
    if (project.status === ProjectStatus.ARCHIVED) {
      return this.findById(membership, projectId, userId);
    }

    const archived = await this.prisma.project.update({
      where: { id: project.id },
      data: { status: ProjectStatus.ARCHIVED },
      select: projectSelect,
    });
    return this.toHub(membership, userId, archived);
  }

  async remove(membership: WorkspaceMembershipContext, projectId: string) {
    assertCanAdminister(membership);
    const project = await this.requireProject(
      membership.workspaceId,
      projectId,
    );

    if (project.status !== ProjectStatus.ARCHIVED) {
      throw new BadRequestException('Archive the project before deleting it');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: {
          projectId: project.id,
          workspaceId: membership.workspaceId,
        },
        data: { projectId: null },
      });
      await tx.project.delete({ where: { id: project.id } });
    });
  }

  async assign(
    membership: WorkspaceMembershipContext,
    actorId: string,
    projectId: string,
    dto: AssignProjectDto,
  ) {
    assertCanMutate(membership);
    const project = await this.requireProject(
      membership.workspaceId,
      projectId,
    );
    const access = await this.resolveAccess(membership, actorId, project.id);
    assertCanManageProject(access);
    if (dto.role === ProjectMemberRole.OWNER && access !== 'OWN') {
      throw new ForbiddenException('Only a project owner can add another owner');
    }
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
      throw new BadRequestException('Assignee must be a workspace member');
    }

    const assignment = await this.prisma.projectAssignment.upsert({
      where: {
        projectId_userId: { projectId: project.id, userId: dto.userId },
      },
      create: {
        workspaceId: membership.workspaceId,
        projectId: project.id,
        userId: dto.userId,
        status: AssignmentStatus.PENDING,
        role: dto.role ?? ProjectMemberRole.MEMBER,
      },
      update: {
        status: AssignmentStatus.PENDING,
        ...(dto.role ? { role: dto.role } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: [dto.userId],
      type: NotificationType.PROJECT_ASSIGNED,
      title: 'Project assigned to you',
      message: project.name,
      entityId: project.id,
      entityType: 'project',
    });
    void actorId;
    return assignment;
  }

  async updateMemberRole(
    membership: WorkspaceMembershipContext,
    actorId: string,
    projectId: string,
    userId: string,
    dto: UpdateProjectMemberDto,
  ) {
    const access = await this.resolveAccess(membership, actorId, projectId);
    assertCanManageProject(access);
    const project = await this.requireProject(
      membership.workspaceId,
      projectId,
    );
    if (userId === project.ownerId && dto.role !== ProjectMemberRole.OWNER) {
      throw new BadRequestException('The project owner stays an owner');
    }
    await this.prisma.projectAssignment.updateMany({
      where: { projectId: project.id, userId },
      data: { role: dto.role },
    });
    return this.listAssignments(membership, projectId);
  }

  async removeMember(
    membership: WorkspaceMembershipContext,
    actorId: string,
    projectId: string,
    userId: string,
  ) {
    const access = await this.resolveAccess(membership, actorId, projectId);
    assertCanManageProject(access);
    const project = await this.requireProject(
      membership.workspaceId,
      projectId,
    );
    if (userId === project.ownerId) {
      throw new BadRequestException('The project owner cannot be removed');
    }
    await this.prisma.projectAssignment.deleteMany({
      where: { projectId: project.id, userId },
    });
  }

  listAssignments(membership: WorkspaceMembershipContext, projectId: string) {
    return this.prisma.projectAssignment.findMany({
      where: {
        projectId,
        project: { workspaceId: membership.workspaceId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmAssignment(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
  ) {
    return this.setAssignmentStatus(
      membership,
      userId,
      projectId,
      AssignmentStatus.IN_PROGRESS,
      NotificationType.PROJECT_CONFIRMED,
    );
  }

  async returnAssignment(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
  ) {
    return this.setAssignmentStatus(
      membership,
      userId,
      projectId,
      AssignmentStatus.RETURNED,
      NotificationType.PROJECT_RETURNED,
    );
  }

  async completeAssignment(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
  ) {
    return this.setAssignmentStatus(
      membership,
      userId,
      projectId,
      AssignmentStatus.COMPLETED,
      NotificationType.PROJECT_COMPLETED,
    );
  }

  private async setAssignmentStatus(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
    status: AssignmentStatus,
    type: NotificationType,
  ) {
    assertCanMutate(membership);
    const assignment = await this.prisma.projectAssignment.findFirst({
      where: {
        projectId,
        userId,
        project: { workspaceId: membership.workspaceId },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Project assignment not found');
    }
    const updated = await this.prisma.projectAssignment.update({
      where: { id: assignment.id },
      data: {
        status,
        workspaceId: assignment.workspaceId ?? membership.workspaceId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    const project = await this.requireProject(
      membership.workspaceId,
      projectId,
    );
    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: [project.ownerId].filter(
        (id): id is string => Boolean(id) && id !== userId,
      ),
      type,
      title: `Project ${status.toLowerCase()}`,
      message: project.name,
      entityId: project.id,
      entityType: 'project',
    });
    return updated;
  }

  async assertProjectInWorkspace(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, status: true },
    });
    if (!project) {
      throw new BadRequestException('Project not found in this workspace');
    }
    return project;
  }

  private async requireProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        ownerId: true,
        name: true,
        description: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async ensureDefaultTeam(workspaceId: string, userId: string) {
    const existing = await this.prisma.team.findFirst({
      where: { workspaceId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return existing.id;
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const team = await this.prisma.team.create({
      data: {
        name: 'General',
        workspaceId,
        ownerId: userId,
        members: {
          create: { userId, workspaceId },
        },
      },
      select: { id: true },
    });
    return team.id;
  }

  async resolveAccess(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string | null,
  ): Promise<ProjectAccessLevel> {
    const workspaceAccess = accessFromWorkspaceRole(membership.role);
    if (!projectId) {
      return workspaceAccess;
    }
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId: membership.workspaceId },
      select: {
        ownerId: true,
        assignments: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (!project) {
      return 'NONE';
    }
    let access = workspaceAccess;
    if (project.ownerId === userId) {
      access = higherAccess(access, 'OWN');
    }
    const assignmentRole = project.assignments[0]?.role;
    if (assignmentRole) {
      const fromProject = accessFromProjectRole(assignmentRole);
      access = canAdminister(membership.role)
        ? higherAccess(access, fromProject)
        : fromProject;
    }
    return access;
  }

  async listMilestones(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
  ) {
    const access = await this.resolveAccess(membership, userId, projectId);
    if (!canView(access)) {
      throw new ForbiddenException('You cannot view this project');
    }
    return this.milestonesWithProgress(membership.workspaceId, projectId);
  }

  async createMilestone(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
    dto: MilestoneWriteDto,
  ) {
    assertCanMutate(membership);
    const access = await this.resolveAccess(membership, userId, projectId);
    if (!canEditWork(access)) {
      throw new ForbiddenException('You cannot add milestones to this project');
    }
    const last = await this.prisma.milestone.aggregate({
      where: { projectId, workspaceId: membership.workspaceId },
      _max: { position: true },
    });
    return this.prisma.milestone.create({
      data: {
        workspaceId: membership.workspaceId,
        projectId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        position: (last._max.position ?? -1) + 1,
      },
    });
  }

  async updateMilestone(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
    milestoneId: string,
    dto: MilestoneWriteDto,
  ) {
    assertCanMutate(membership);
    const access = await this.resolveAccess(membership, userId, projectId);
    if (!canEditWork(access)) {
      throw new ForbiddenException('You cannot edit this milestone');
    }
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId, workspaceId: membership.workspaceId },
      select: { id: true },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }
    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async removeMilestone(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
    milestoneId: string,
  ) {
    assertCanMutate(membership);
    const access = await this.resolveAccess(membership, userId, projectId);
    if (!canEditWork(access)) {
      throw new ForbiddenException('You cannot delete this milestone');
    }
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId, workspaceId: membership.workspaceId },
      select: { id: true },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }
    await this.prisma.milestone.delete({ where: { id: milestoneId } });
    return { ok: true };
  }

  async timeline(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
  ) {
    const access = await this.resolveAccess(membership, userId, projectId);
    if (!canView(access)) {
      throw new ForbiddenException('You cannot view this project');
    }
    const [project, tasks, milestones, edges] = await Promise.all([
      this.requireProject(membership.workspaceId, projectId),
      this.prisma.task.findMany({
        where: {
          workspaceId: membership.workspaceId,
          projectId,
          status: { not: TaskStatus.ARCHIVED },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          startDate: true,
          dueDate: true,
          milestoneId: true,
          parentId: true,
        },
        orderBy: [{ startDate: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
      }),
      this.milestonesWithProgress(membership.workspaceId, projectId),
      this.prisma.taskDependency.findMany({
        where: {
          workspaceId: membership.workspaceId,
          fromTask: { projectId },
        },
        select: { fromTaskId: true, toTaskId: true, type: true },
      }),
    ]);
    const incomplete = new Set(
      tasks
        .filter((task) => task.status !== TaskStatus.COMPLETED)
        .map((task) => task.id),
    );
    const blocked = new Set<string>();
    for (const edge of edges) {
      if (edge.type === DependencyType.RELATED) continue;
      if (
        (edge.type === DependencyType.DEPENDS_ON ||
          edge.type === DependencyType.BLOCKED_BY) &&
        incomplete.has(edge.toTaskId)
      ) {
        blocked.add(edge.fromTaskId);
      }
      if (edge.type === DependencyType.BLOCKS && incomplete.has(edge.fromTaskId)) {
        blocked.add(edge.toTaskId);
      }
    }
    const dates = [
      project.startDate,
      project.endDate,
      ...tasks.map((task) => task.startDate),
      ...tasks.map((task) => task.dueDate),
      ...milestones.map((item) => item.dueDate),
    ].filter((value): value is Date => Boolean(value));
    const start = dates.length
      ? new Date(Math.min(...dates.map((item) => item.getTime())))
      : new Date();
    const end = dates.length
      ? new Date(Math.max(...dates.map((item) => item.getTime())))
      : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    return {
      project: { id: project.id, name: project.name },
      canEdit: canEditWork(access),
      range: { start: start.toISOString(), end: end.toISOString() },
      milestones,
      tasks: tasks.map((task) => ({
        ...task,
        blocked: blocked.has(task.id),
        dependsOn: edges
          .filter(
            (edge) =>
              edge.fromTaskId === task.id &&
              (edge.type === DependencyType.DEPENDS_ON ||
                edge.type === DependencyType.BLOCKED_BY),
          )
          .map((edge) => edge.toTaskId),
      })),
    };
  }

  listTemplates(membership: WorkspaceMembershipContext) {
    return this.prisma.projectTemplate
      .findMany({
        where: { workspaceId: membership.workspaceId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          payload: true,
        },
      })
      .then((rows) => [
        ...BUILTIN_TEMPLATES.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          builtin: true as const,
          payload: item.payload,
        })),
        ...rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          builtin: false as const,
          createdAt: row.createdAt,
          payload: row.payload as TemplatePayload,
        })),
      ]);
  }

  async saveAsTemplate(
    membership: WorkspaceMembershipContext,
    userId: string,
    projectId: string,
    dto: SaveTemplateDto,
  ) {
    assertCanMutate(membership);
    const access = await this.resolveAccess(membership, userId, projectId);
    if (!canEditWork(access)) {
      throw new ForbiddenException('You cannot save this project as a template');
    }
    const project = await this.requireProject(membership.workspaceId, projectId);
    const [milestones, tasks, edges] = await Promise.all([
      this.prisma.milestone.findMany({
        where: { projectId, workspaceId: membership.workspaceId },
        orderBy: { position: 'asc' },
        select: { id: true, title: true, dueDate: true },
      }),
      this.prisma.task.findMany({
        where: { projectId, workspaceId: membership.workspaceId, parentId: null },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          estimatedMinutes: true,
          milestoneId: true,
          subtasks: {
            select: {
              id: true,
              title: true,
              description: true,
              priority: true,
              estimatedMinutes: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.taskDependency.findMany({
        where: {
          workspaceId: membership.workspaceId,
          fromTask: { projectId },
          type: {
            in: [DependencyType.DEPENDS_ON, DependencyType.BLOCKED_BY],
          },
        },
        select: { fromTaskId: true, toTaskId: true },
      }),
    ]);
    const milestoneKey = new Map(
      milestones.map((item, index) => [item.id, `m-${index}`]),
    );
    const taskKey = new Map<string, string>();
    const payloadTasks: TemplatePayload['tasks'] = [];
    tasks.forEach((task, index) => {
      const key = `t-${index}`;
      taskKey.set(task.id, key);
      payloadTasks.push({
        key,
        title: task.title,
        description: task.description ?? undefined,
        priority: task.priority,
        estimatedHours: task.estimatedMinutes
          ? Math.round((task.estimatedMinutes / 60) * 100) / 100
          : undefined,
        milestoneKey: task.milestoneId
          ? milestoneKey.get(task.milestoneId)
          : undefined,
      });
      task.subtasks.forEach((sub, subIndex) => {
        const subKey = `t-${index}-s-${subIndex}`;
        taskKey.set(sub.id, subKey);
        payloadTasks.push({
          key: subKey,
          title: sub.title,
          description: sub.description ?? undefined,
          priority: sub.priority,
          estimatedHours: sub.estimatedMinutes
            ? Math.round((sub.estimatedMinutes / 60) * 100) / 100
            : undefined,
          parentKey: key,
        });
      });
    });
    for (const edge of edges) {
      const from = taskKey.get(edge.fromTaskId);
      const to = taskKey.get(edge.toTaskId);
      if (!from || !to) continue;
      const task = payloadTasks.find((item) => item.key === from);
      if (task) {
        task.dependsOnKeys = [...new Set([...(task.dependsOnKeys ?? []), to])];
      }
    }
    const created = await this.prisma.projectTemplate.create({
      data: {
        workspaceId: membership.workspaceId,
        createdById: userId,
        name: dto.name?.trim() || `${project.name} template`,
        description: project.description,
        payload: {
          milestones: milestones.map((item, index) => ({
            key: `m-${index}`,
            title: item.title,
            dueOffsetDays: item.dueDate
              ? Math.max(
                  0,
                  Math.round(
                    (item.dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
                  ),
                )
              : undefined,
          })),
          tasks: payloadTasks,
        } as Prisma.InputJsonValue,
      },
    });
    return { id: created.id, name: created.name, builtin: false };
  }

  async createFromTemplate(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateFromTemplateDto,
  ) {
    assertCanMutate(membership);
    const template = await this.resolveTemplate(membership.workspaceId, dto.templateId);
    const created = await this.create(membership, userId, {
      name: dto.name?.trim() || template.name,
      description: template.description ?? undefined,
    });
    const payload = template.payload;
    const milestoneIds = new Map<string, string>();
    for (const [index, item] of payload.milestones.entries()) {
      const due = item.dueOffsetDays
        ? new Date(Date.now() + item.dueOffsetDays * 24 * 60 * 60 * 1000)
        : null;
      const row = await this.prisma.milestone.create({
        data: {
          workspaceId: membership.workspaceId,
          projectId: created.id,
          title: item.title,
          dueDate: due,
          position: index,
        },
      });
      milestoneIds.set(item.key, row.id);
    }
    const taskIds = new Map<string, string>();
    const roots = payload.tasks.filter((item) => !item.parentKey);
    const children = payload.tasks.filter((item) => item.parentKey);
    for (const item of [...roots, ...children]) {
      const parentId = item.parentKey ? taskIds.get(item.parentKey) : undefined;
      if (item.parentKey && !parentId) continue;
      const row = await this.prisma.task.create({
        data: {
          workspaceId: membership.workspaceId,
          projectId: created.id,
          ownerId: userId,
          assignedById: userId,
          title: item.title,
          description: item.description ?? null,
          priority: (item.priority as Priority | undefined) ?? Priority.MEDIUM,
          estimatedMinutes:
            item.estimatedHours != null
              ? minutesFromHours(item.estimatedHours)
              : null,
          milestoneId: item.milestoneKey
            ? (milestoneIds.get(item.milestoneKey) ?? null)
            : null,
          parentId: parentId ?? null,
        },
        select: { id: true },
      });
      taskIds.set(item.key, row.id);
    }
    for (const item of payload.tasks) {
      const fromId = taskIds.get(item.key);
      if (!fromId || !item.dependsOnKeys?.length) continue;
      for (const key of item.dependsOnKeys) {
        const toId = taskIds.get(key);
        if (!toId) continue;
        await this.prisma.taskDependency.create({
          data: {
            workspaceId: membership.workspaceId,
            fromTaskId: fromId,
            toTaskId: toId,
            type: DependencyType.DEPENDS_ON,
          },
        });
      }
    }
    return this.findById(membership, created.id, userId);
  }

  private async resolveTemplate(workspaceId: string, templateId: string) {
    const builtin = BUILTIN_TEMPLATES.find((item) => item.id === templateId);
    if (builtin) {
      return {
        name: builtin.name,
        description: builtin.description,
        payload: builtin.payload,
      };
    }
    const row = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, workspaceId },
    });
    if (!row) {
      throw new NotFoundException('Template not found');
    }
    return {
      name: row.name,
      description: row.description,
      payload: row.payload as TemplatePayload,
    };
  }

  private async milestonesWithProgress(workspaceId: string, projectId: string) {
    const milestones = await this.prisma.milestone.findMany({
      where: { workspaceId, projectId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        position: true,
        progress: true,
        _count: { select: { tasks: true } },
      },
    });
    const counts = await this.prisma.task.groupBy({
      by: ['milestoneId', 'status'],
      where: { workspaceId, projectId, milestoneId: { not: null } },
      _count: { _all: true },
    });
    return milestones.map((milestone) => {
      const related = counts.filter((row) => row.milestoneId === milestone.id);
      const total = related.reduce((sum, row) => sum + row._count._all, 0);
      const completed = related
        .filter((row) => row.status === TaskStatus.COMPLETED)
        .reduce((sum, row) => sum + row._count._all, 0);
      const progress =
        total > 0 ? Math.round((completed / total) * 100) : milestone.progress;
      return {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        dueDate: milestone.dueDate,
        position: milestone.position,
        progress,
        taskCount: total,
      };
    });
  }

  private async toHub(
    membership: WorkspaceMembershipContext,
    userId: string,
    project: Prisma.ProjectGetPayload<{ select: typeof projectSelect }>,
  ) {
    const completed = await this.prisma.task.count({
      where: {
        projectId: project.id,
        workspaceId: membership.workspaceId,
        status: TaskStatus.COMPLETED,
      },
    });
    const access = await this.resolveAccess(membership, userId, project.id);
    const members = project.assignments.map((item) => ({
      id: item.id,
      userId: item.userId,
      status: item.status,
      role: item.role,
      createdAt: item.createdAt,
      user: item.user,
    }));
    if (!members.some((item) => item.userId === project.ownerId)) {
      members.unshift({
        id: `owner-${project.id}`,
        userId: project.ownerId,
        status: AssignmentStatus.COMPLETED,
        role: ProjectMemberRole.OWNER,
        createdAt: project.createdAt,
        user: project.owner,
      });
    }
    const total = project._count.tasks;
    return {
      ...project,
      dueDate: project.endDate,
      progress: {
        completed,
        total,
        percent: total ? Math.round((completed / total) * 100) : 0,
      },
      members,
      myAccess: access,
    };
  }

  private async assertTeamInWorkspace(workspaceId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, workspaceId },
      select: { id: true },
    });
    if (!team) {
      throw new BadRequestException('Team not found in this workspace');
    }
    return team.id;
  }

  private assertDates(
    startDate?: string | Date | null,
    endDate?: string | Date | null,
  ) {
    if (!startDate || !endDate) {
      return;
    }
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('End date cannot be before start date');
    }
  }

  private async applyDerivedStatuses<
    T extends { id: string; status: ProjectStatus; startDate: Date | null },
  >(workspaceId: string, projects: T[]): Promise<T[]> {
    const live = projects.filter(
      (project) =>
        project.status !== ProjectStatus.ARCHIVED &&
        project.status !== ProjectStatus.ON_HOLD,
    );
    if (!live.length) {
      return projects;
    }

    const groups = await this.prisma.task.groupBy({
      by: ['projectId', 'status'],
      where: {
        workspaceId,
        projectId: { in: live.map((project) => project.id) },
        status: { not: TaskStatus.ARCHIVED },
      },
      _count: { _all: true },
    });
    const byProject = new Map<string, Partial<Record<TaskStatus, number>>>();
    for (const row of groups) {
      if (!row.projectId) {
        continue;
      }
      const counts = byProject.get(row.projectId) ?? {};
      counts[row.status] = row._count._all;
      byProject.set(row.projectId, counts);
    }

    const drifted: Array<{ id: string; status: ProjectStatus }> = [];
    const nextProjects = projects.map((project) => {
      if (
        project.status === ProjectStatus.ARCHIVED ||
        project.status === ProjectStatus.ON_HOLD
      ) {
        return project;
      }
      const next = deriveProjectStatus({
        currentStatus: project.status,
        startDate: project.startDate,
        taskCounts: byProject.get(project.id) ?? {},
      });
      if (next !== project.status) {
        drifted.push({ id: project.id, status: next });
        return { ...project, status: next };
      }
      return project;
    });

    if (drifted.length) {
      await Promise.all(
        drifted.map((item) =>
          this.prisma.project.update({
            where: { id: item.id },
            data: { status: item.status },
          }),
        ),
      );
    }
    return nextProjects;
  }
}

export function deriveProjectStatus(input: {
  currentStatus: ProjectStatus;
  startDate: Date | null;
  taskCounts: Partial<Record<TaskStatus, number>>;
}): ProjectStatus {
  if (input.currentStatus === ProjectStatus.ARCHIVED) {
    return ProjectStatus.ARCHIVED;
  }
  if (input.currentStatus === ProjectStatus.ON_HOLD) {
    return ProjectStatus.ON_HOLD;
  }

  const completed = input.taskCounts[TaskStatus.COMPLETED] ?? 0;
  const inFlight =
    (input.taskCounts[TaskStatus.IN_PROGRESS] ?? 0) +
    (input.taskCounts[TaskStatus.IN_REVIEW] ?? 0) +
    (input.taskCounts[TaskStatus.RETURNED] ?? 0) +
    (input.taskCounts[TaskStatus.OVERDUE] ?? 0);
  const todo = input.taskCounts[TaskStatus.TODO] ?? 0;
  const total = completed + inFlight + todo;

  if (total > 0 && completed === total) {
    return ProjectStatus.COMPLETED;
  }
  if (inFlight > 0) {
    return ProjectStatus.ACTIVE;
  }

  const start = input.startDate ? startOfLocalDay(input.startDate) : null;
  const today = startOfLocalDay(new Date());
  if (start && start.getTime() > today.getTime()) {
    return ProjectStatus.PLANNING;
  }
  if (total > 0 || (start && start.getTime() <= today.getTime())) {
    return ProjectStatus.ACTIVE;
  }
  return ProjectStatus.PLANNING;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
