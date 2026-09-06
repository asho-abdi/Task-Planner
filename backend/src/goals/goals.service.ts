import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanMutate } from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { ProjectsService } from '../projects/projects.service';
import {
  CreateGoalDto,
  MilestoneInputDto,
  UpdateGoalDto,
} from './dto/goal.dto';

const goalSelect = {
  id: true,
  title: true,
  description: true,
  targetDate: true,
  progress: true,
  workspaceId: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  projects: {
    select: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          milestones: {
            where: { projectId: { not: null } },
            select: {
              id: true,
              title: true,
              dueDate: true,
              progress: true,
              position: true,
            },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  },
  milestones: {
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      position: true,
      progress: true,
    },
    orderBy: { position: 'asc' },
  },
  tasks: {
    select: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          projectId: true,
          milestoneId: true,
        },
      },
    },
  },
} satisfies Prisma.GoalSelect;

type GoalRecord = Prisma.GoalGetPayload<{ select: typeof goalSelect }>;

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(membership: WorkspaceMembershipContext) {
    const goals = await this.prisma.goal.findMany({
      where: { workspaceId: membership.workspaceId },
      select: goalSelect,
      orderBy: { updatedAt: 'desc' },
    });
    return this.withComputedProgress(membership.workspaceId, goals);
  }

  async findById(membership: WorkspaceMembershipContext, goalId: string) {
    const goal = await this.requireGoal(membership.workspaceId, goalId);
    const [enriched] = await this.withComputedProgress(membership.workspaceId, [
      goal,
    ]);
    return enriched;
  }

  async create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateGoalDto,
  ) {
    assertCanMutate(membership);
    const projectIds = await this.normalizeProjects(
      membership.workspaceId,
      dto.projectIds ?? [],
    );
    const taskIds = await this.normalizeTasks(
      membership.workspaceId,
      dto.taskIds ?? [],
    );
    const milestones = this.normalizeMilestones(dto.milestones ?? []);
    const progress =
      dto.progress ??
      (milestones.length ? this.averageProgress(milestones) : 0);

    const goal = await this.prisma.goal.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        progress,
        workspaceId: membership.workspaceId,
        ownerId: userId,
        projects: {
          create: projectIds.map((projectId) => ({ projectId })),
        },
        tasks: {
          create: taskIds.map((taskId) => ({ taskId })),
        },
        milestones: {
          create: milestones.map((item, position) => ({
            workspaceId: membership.workspaceId,
            title: item.title,
            description: item.description,
            dueDate: item.dueDate,
            progress: item.progress,
            position,
          })),
        },
      },
      select: goalSelect,
    });
    const [enriched] = await this.withComputedProgress(membership.workspaceId, [
      goal,
    ]);
    return enriched;
  }

  async update(
    membership: WorkspaceMembershipContext,
    goalId: string,
    dto: UpdateGoalDto,
  ) {
    assertCanMutate(membership);
    await this.requireGoal(membership.workspaceId, goalId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.projectIds) {
        const projectIds = await this.normalizeProjects(
          membership.workspaceId,
          dto.projectIds,
        );
        await tx.goalProject.deleteMany({ where: { goalId } });
        for (const projectId of projectIds) {
          await tx.goalProject.create({ data: { goalId, projectId } });
        }
      }
      if (dto.taskIds) {
        const taskIds = await this.normalizeTasks(
          membership.workspaceId,
          dto.taskIds,
        );
        await tx.goalTask.deleteMany({ where: { goalId } });
        for (const taskId of taskIds) {
          await tx.goalTask.create({ data: { goalId, taskId } });
        }
      }
      if (dto.milestones) {
        const milestones = this.normalizeMilestones(dto.milestones);
        await tx.milestone.deleteMany({ where: { goalId } });
        for (const [position, item] of milestones.entries()) {
          await tx.milestone.create({
            data: {
              workspaceId: membership.workspaceId,
              goalId,
              title: item.title,
              description: item.description,
              dueDate: item.dueDate,
              progress: item.progress,
              position,
            },
          });
        }
      }

      let progress = dto.progress;
      if (progress === undefined && dto.milestones) {
        const milestones = this.normalizeMilestones(dto.milestones);
        progress = milestones.length ? this.averageProgress(milestones) : 0;
      }

      return tx.goal.update({
        where: { id: goalId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.targetDate !== undefined
            ? { targetDate: dto.targetDate ? new Date(dto.targetDate) : null }
            : {}),
          ...(progress !== undefined ? { progress } : {}),
        },
        select: goalSelect,
      });
    });

    const [enriched] = await this.withComputedProgress(membership.workspaceId, [
      updated,
    ]);
    return enriched;
  }

  private async requireGoal(workspaceId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, workspaceId },
      select: goalSelect,
    });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    return goal;
  }

  private async normalizeProjects(workspaceId: string, projectIds: string[]) {
    const unique = [...new Set(projectIds.filter(Boolean))];
    for (const projectId of unique) {
      const project = await this.projectsService.assertProjectInWorkspace(
        workspaceId,
        projectId,
      );
      if (project.status === ProjectStatus.ARCHIVED) {
        throw new BadRequestException('Cannot link an archived project');
      }
    }
    return unique;
  }

  private async normalizeTasks(workspaceId: string, taskIds: string[]) {
    const unique = [...new Set(taskIds.filter(Boolean))];
    if (!unique.length) {
      return [];
    }
    const found = await this.prisma.task.findMany({
      where: { workspaceId, id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Tasks must belong to this workspace');
    }
    return unique;
  }

  private normalizeMilestones(items: MilestoneInputDto[]) {
    return items.map((item) => ({
      title: item.title.trim(),
      description: item.description?.trim() || null,
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
      progress: this.clampProgress(item.progress ?? 0),
    }));
  }

  private averageProgress(items: { progress: number }[]) {
    const total = items.reduce((sum, item) => sum + item.progress, 0);
    return this.clampProgress(Math.round(total / items.length));
  }

  private clampProgress(value: number) {
    return Math.min(100, Math.max(0, value));
  }

  private async withComputedProgress(workspaceId: string, goals: GoalRecord[]) {
    if (!goals.length) {
      return [];
    }
    const projectIds = [
      ...new Set(
        goals.flatMap((goal) =>
          (goal.projects ?? []).map((item) => item.project.id),
        ),
      ),
    ];
    const milestoneIds = [
      ...new Set(
        goals.flatMap((goal) => [
          ...(goal.milestones ?? []).map((item) => item.id),
          ...(goal.projects ?? []).flatMap((item) =>
            (item.project.milestones ?? []).map((milestone) => milestone.id),
          ),
        ]),
      ),
    ];
    const [projectGroups, milestoneGroups] = await Promise.all([
      projectIds.length
        ? this.prisma.task.groupBy({
            by: ['projectId', 'status'],
            where: {
              workspaceId,
              projectId: { in: projectIds },
              status: { not: TaskStatus.ARCHIVED },
            },
            _count: { _all: true },
          })
        : Promise.resolve(
            [] as Array<{
              projectId: string | null;
              status: TaskStatus;
              _count: { _all: number };
            }>,
          ),
      milestoneIds.length
        ? this.prisma.task.groupBy({
            by: ['milestoneId', 'status'],
            where: {
              workspaceId,
              milestoneId: { in: milestoneIds },
              status: { not: TaskStatus.ARCHIVED },
            },
            _count: { _all: true },
          })
        : Promise.resolve(
            [] as Array<{
              milestoneId: string | null;
              status: TaskStatus;
              _count: { _all: number };
            }>,
          ),
    ]);

    return goals.map((goal) => {
      const linkedTasks = (goal.tasks ?? []).map((item) => item.task);
      const projectTaskStats = new Map<
        string,
        { completed: number; total: number }
      >();
      for (const group of projectGroups) {
        if (!group.projectId) continue;
        const current = projectTaskStats.get(group.projectId) ?? {
          completed: 0,
          total: 0,
        };
        current.total += group._count._all;
        if (group.status === TaskStatus.COMPLETED) {
          current.completed += group._count._all;
        }
        projectTaskStats.set(group.projectId, current);
      }
      const milestoneProgress = (id: string, fallback: number) => {
        const related = milestoneGroups.filter((row) => row.milestoneId === id);
        const total = related.reduce((sum, row) => sum + row._count._all, 0);
        if (!total) return fallback;
        const completed = related
          .filter((row) => row.status === TaskStatus.COMPLETED)
          .reduce((sum, row) => sum + row._count._all, 0);
        return this.clampProgress(Math.round((completed / total) * 100));
      };

      const projectTree = (goal.projects ?? []).map((item) => {
        const stats = projectTaskStats.get(item.project.id) ?? {
          completed: 0,
          total: 0,
        };
        return {
          id: item.project.id,
          name: item.project.name,
          status: item.project.status,
          progress:
            stats.total === 0
              ? 0
              : this.clampProgress(
                  Math.round((stats.completed / stats.total) * 100),
                ),
          taskCount: stats.total,
          milestones: item.project.milestones.map((milestone) => ({
            ...milestone,
            progress: milestoneProgress(milestone.id, milestone.progress),
          })),
        };
      });

      const goalMilestones = (goal.milestones ?? []).map((milestone) => ({
        ...milestone,
        progress: milestoneProgress(milestone.id, milestone.progress),
      }));

      const allTaskStats = [...projectTaskStats.values()];
      const linkedCompleted = linkedTasks.filter(
        (task) => task.status === TaskStatus.COMPLETED,
      ).length;
      const linkedOpen = linkedTasks.filter(
        (task) =>
          task.status !== TaskStatus.COMPLETED &&
          task.status !== TaskStatus.ARCHIVED,
      ).length;
      const projectCompleted = allTaskStats.reduce(
        (sum, item) => sum + item.completed,
        0,
      );
      const projectTotal = allTaskStats.reduce(
        (sum, item) => sum + item.total,
        0,
      );
      const denom = projectTotal + linkedCompleted + linkedOpen;
      const progress =
        denom > 0
          ? this.clampProgress(
              Math.round(
                ((projectCompleted + linkedCompleted) / denom) * 100,
              ),
            )
          : goalMilestones.length
            ? this.averageProgress(goalMilestones)
            : goal.progress;

      return {
        ...this.toGoal(goal, projectTree, goalMilestones, linkedTasks),
        progress,
      };
    });
  }

  private toGoal(
    goal: GoalRecord,
    projects: Array<{
      id: string;
      name: string;
      status: string;
      progress: number;
      taskCount: number;
      milestones: Array<{
        id: string;
        title: string;
        dueDate: Date | null;
        progress: number;
        position: number;
      }>;
    }>,
    milestones: GoalRecord['milestones'],
    tasks: Array<{
      id: string;
      title: string;
      status: TaskStatus;
      projectId: string | null;
      milestoneId: string | null;
    }>,
  ) {
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      targetDate: goal.targetDate,
      progress: goal.progress,
      workspaceId: goal.workspaceId,
      ownerId: goal.ownerId,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      owner: goal.owner,
      projects,
      milestones,
      tasks,
    };
  }
}
