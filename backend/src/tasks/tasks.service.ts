import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ActivityType,
  Prisma,
  ProjectStatus,
  RecurrenceRule,
  SubmissionStatus,
  TaskParticipantRole,
  TaskSharePermission,
  TaskStatus,
  TaskVisibility,
  WorkspaceMemberStatus,
  WorkspaceRole,
  DependencyType,
  NotificationType,
  AutomationTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCanMutate,
  canAdminister,
  canEditWork,
  shareAllowsComment,
  shareAllowsEdit,
} from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from '../automations/automations.service';
import { ActivityService } from '../activity/activity.service';
import { RealtimeService } from '../realtime/realtime.service';
import { resolveMentionedUserIds } from '../common/mentions';
import {
  SUBMITTABLE_STATUSES,
  assertValidTaskStatusTransition,
  resolveCollaborativeTaskStatus,
} from './task-status';
import {
  ApplyScheduleDto,
  AssignTaskDto,
  CreateCommentDto,
  CreateTaskDto,
  ListTasksQueryDto,
  ReturnTaskDto,
  ReviewSubmissionDto,
  ShareTaskDto,
  SubmitTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  UpdateTaskVisibilityDto,
} from './dto/task.dto';
import { hoursFromMinutes, minutesFromHours } from '../reports/scoring';

const assigneeSelect = {
  userId: true,
  role: true,
  user: {
    select: { id: true, name: true, email: true },
  },
} satisfies Prisma.TaskAssigneeSelect;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  projectId: true,
  workspaceId: true,
  ownerId: true,
  assignedById: true,
  startedAt: true,
  createdAt: true,
  updatedAt: true,
  startDate: true,
  estimatedMinutes: true,
  parentId: true,
  recurrence: true,
  recurrenceAnchor: true,
  scheduledStart: true,
  scheduledEnd: true,
  visibility: true,
  meetingId: true,
  meeting: {
    select: { id: true, title: true },
  },
  project: {
    select: { id: true, name: true, status: true },
  },
  owner: {
    select: { id: true, name: true, email: true },
  },
  assignedBy: {
    select: { id: true, name: true, email: true },
  },
  assignees: {
    orderBy: { id: 'asc' },
    select: assigneeSelect,
  },
  shares: {
    select: {
      id: true,
      userId: true,
      permission: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  submissions: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      submitterId: true,
      status: true,
      version: true,
      note: true,
      reviewNote: true,
      deliverables: true,
      justification: true,
      createdAt: true,
      reviewedAt: true,
      submitter: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  },
  outgoingDependencies: {
    select: {
      type: true,
      toTask: { select: { id: true, title: true, status: true } },
    },
  },
  incomingDependencies: {
    select: {
      type: true,
      fromTask: { select: { id: true, title: true, status: true } },
    },
  },
  milestone: {
    select: { id: true, title: true, dueDate: true, projectId: true },
  },
} satisfies Prisma.TaskSelect;

type TaskRecord = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly notifications: NotificationsService,
    private readonly automations: AutomationsService,
    @Optional() private readonly activity?: ActivityService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async list(
    membership: WorkspaceMembershipContext,
    userId: string,
    query: ListTasksQueryDto,
  ) {
    await this.markOverdue(membership.workspaceId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildListWhere(membership, userId, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        select: taskSelect,
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    await this.persistCollaborativeStatuses(items);

    return {
      items: items.map((task) => this.toTaskResponse(task)),
      page,
      pageSize,
      total,
    };
  }

  async findById(
    membership: WorkspaceMembershipContext,
    taskId: string,
    userId?: string,
  ) {
    await this.markOverdue(membership.workspaceId);
    await this.completeApprovedReview(membership.workspaceId, taskId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId: membership.workspaceId },
      select: taskSelect,
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (userId) {
      const allowed = await this.canViewTask(membership, userId, task);
      if (!allowed) {
        throw new NotFoundException('Task not found');
      }
    }
    return this.respondWithSubmissionFiles(task);
  }

  async create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateTaskDto,
  ) {
    assertCanMutate(membership);
    if (dto.status && dto.status !== TaskStatus.TODO) {
      throw new BadRequestException(
        'Task status is automatic. New tasks start as assigned.',
      );
    }
    const status = TaskStatus.TODO;

    if (dto.projectId) {
      await this.assertUsableProject(membership.workspaceId, dto.projectId);
      const access = await this.projectsService.resolveAccess(
        membership,
        userId,
        dto.projectId,
      );
      if (!canEditWork(access)) {
        throw new ForbiddenException('You cannot add tasks to this project');
      }
    }
    const participants = this.resolveParticipants(dto);
    for (const row of participants) {
      await this.assertCanAssign(
        membership,
        userId,
        row.userId,
        dto.projectId ?? null,
      );
    }
    if (dto.parentId) {
      await this.assertParent(membership.workspaceId, dto.parentId);
    }
    const milestoneId = dto.milestoneId
      ? await this.assertMilestone(
          membership.workspaceId,
          dto.milestoneId,
          dto.projectId ?? null,
        )
      : null;

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          status,
          priority: dto.priority,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          estimatedMinutes:
            dto.estimatedHours === undefined
              ? undefined
              : minutesFromHours(dto.estimatedHours),
          projectId: dto.projectId ?? null,
          workspaceId: membership.workspaceId,
          ownerId:
            participants.find((row) => row.role === TaskParticipantRole.ASSIGNEE)
              ?.userId ?? null,
          assignedById: userId,
          parentId: dto.parentId ?? null,
          recurrence: dto.recurrence,
          recurrenceAnchor: dto.recurrence
            ? dto.dueDate
              ? new Date(dto.dueDate)
              : new Date()
            : null,
          startedAt: null,
          visibility:
            dto.visibility ??
            (dto.projectId ? TaskVisibility.PROJECT : TaskVisibility.WORKSPACE),
          meetingId: dto.meetingId ?? null,
          milestoneId,
          ...(this.participantCreates(dto).length
            ? {
                assignees: {
                  create: this.participantCreates(dto),
                },
              }
            : {}),
        },
        select: { id: true },
      });
      if (dto.dependsOnTaskIds?.length) {
        await this.replaceDependsOn(
          tx,
          membership.workspaceId,
          created.id,
          dto.dependsOnTaskIds,
        );
      }
      if (dto.blocksTaskIds?.length) {
        await this.replaceBlocks(
          tx,
          membership.workspaceId,
          created.id,
          dto.blocksTaskIds,
        );
      }
      return tx.task.findFirstOrThrow({
        where: { id: created.id },
        select: taskSelect,
      });
    });

    const response = this.toTaskResponse(task);
    await this.notifyAssignment(membership.workspaceId, userId, response);
    await this.automations.dispatch({
      workspaceId: membership.workspaceId,
      trigger: AutomationTrigger.TASK_CREATED,
      actorUserId: userId,
      ownerId: userId,
      assigneeIds: dto.assigneeId ? [dto.assigneeId] : [],
      title: `Task created: ${task.title}`,
      entityId: task.id,
      entityType: 'task',
    });
    await this.refreshProjectStatus(membership.workspaceId, task.projectId);
    await this.activity?.log({
      workspaceId: membership.workspaceId,
      actorId: userId,
      type: ActivityType.TASK_CREATED,
      title: `created a task`,
      entityType: 'task',
      entityId: task.id,
    });
    return response;
  }

  async update(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
    source: 'patch' | 'start' = 'patch',
  ) {
    assertCanMutate(membership);
    const task = await this.requireTask(membership.workspaceId, taskId);
    if (dto.status !== undefined && source !== 'start') {
      throw new BadRequestException(
        'Task status is automatic. Start work, submit, or review instead of setting it.',
      );
    }
    const data: Prisma.TaskUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.priority !== undefined) {
      data.priority = dto.priority;
    }
    if (dto.estimatedHours !== undefined) {
      data.estimatedMinutes =
        dto.estimatedHours === null
          ? null
          : minutesFromHours(dto.estimatedHours);
    }
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.recurrence !== undefined) {
      data.recurrence = dto.recurrence;
      data.recurrenceAnchor = dto.recurrence
        ? task.dueDate ?? new Date()
        : null;
    }

    let nextStatus = task.status;
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      if (
        task.status === TaskStatus.OVERDUE &&
        dto.dueDate &&
        new Date(dto.dueDate).getTime() > Date.now()
      ) {
        nextStatus = task.preOverdueStatus ?? TaskStatus.TODO;
      }
    }

    if (source === 'start') {
      nextStatus = TaskStatus.IN_PROGRESS;
    }

    if (nextStatus !== task.status) {
      assertValidTaskStatusTransition(task.status, nextStatus);
      if (nextStatus === TaskStatus.IN_PROGRESS) {
        await this.assertCanStart(membership, userId, taskId, task.status);
      }
      data.status = nextStatus;
      if (nextStatus === TaskStatus.IN_PROGRESS && !task.startedAt) {
        data.startedAt = new Date();
      }
      if (nextStatus === TaskStatus.OVERDUE) {
        data.preOverdueStatus = task.status;
      } else if (task.status === TaskStatus.OVERDUE) {
        data.preOverdueStatus = null;
      }
    }

    if (dto.projectId !== undefined) {
      if (dto.projectId) {
        await this.assertUsableProject(membership.workspaceId, dto.projectId);
        data.project = { connect: { id: dto.projectId } };
      } else {
        data.project = { disconnect: true };
      }
    }

    if (dto.visibility !== undefined) {
      data.visibility = dto.visibility;
    }

    if (dto.milestoneId !== undefined) {
      if (dto.milestoneId) {
        const projectId =
          dto.projectId === undefined ? task.projectId : dto.projectId;
        await this.assertMilestone(
          membership.workspaceId,
          dto.milestoneId,
          projectId,
        );
        data.milestone = { connect: { id: dto.milestoneId } };
      } else {
        data.milestone = { disconnect: true };
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (
        dto.assigneeId !== undefined ||
        dto.assigneeIds !== undefined ||
        dto.collaboratorIds !== undefined ||
        dto.watcherIds !== undefined
      ) {
        const participants = this.resolveParticipants(dto);
        for (const row of participants) {
          await this.assertCanAssign(
            membership,
            userId,
            row.userId,
            dto.projectId === undefined ? task.projectId : dto.projectId,
          );
        }
        await this.replaceParticipants(tx, task.id, participants);
        const primary = participants.find(
          (row) => row.role === TaskParticipantRole.ASSIGNEE,
        );
        data.owner = primary
          ? { connect: { id: primary.userId } }
          : { disconnect: true };
        data.assignedBy = { connect: { id: userId } };
      }

      if (dto.dependsOnTaskIds) {
        await this.replaceDependsOn(
          tx,
          membership.workspaceId,
          task.id,
          dto.dependsOnTaskIds,
        );
      }
      if (dto.blocksTaskIds) {
        await this.replaceBlocks(
          tx,
          membership.workspaceId,
          task.id,
          dto.blocksTaskIds,
        );
      }

      return tx.task.update({
        where: { id: task.id },
        data,
        select: taskSelect,
      });
    });

    const response = this.toTaskResponse(updated);
    if (dto.assigneeId !== undefined || dto.assigneeIds !== undefined) {
      await this.notifyAssignment(membership.workspaceId, userId, response);
    }
    await this.refreshProjectStatus(membership.workspaceId, task.projectId);
    if (dto.projectId !== undefined && dto.projectId !== task.projectId) {
      await this.refreshProjectStatus(membership.workspaceId, dto.projectId);
    }
    if (source === 'start' && nextStatus !== task.status) {
      await this.activity?.log({
        workspaceId: membership.workspaceId,
        actorId: userId,
        type: ActivityType.TASK_STATUS_CHANGED,
        title: `started work`,
        entityType: 'task',
        entityId: task.id,
      });
    }
    return response;
  }

  async changeStatus(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    if (dto.status !== TaskStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Task status is automatic. Start work, submit, or review instead of setting it.',
      );
    }
    return this.update(membership, userId, taskId, {}, 'start');
  }

  async assign(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    dto: AssignTaskDto,
  ) {
    assertCanMutate(membership);
    const task = await this.requireTask(membership.workspaceId, taskId);
    if (task.status === TaskStatus.ARCHIVED) {
      throw new BadRequestException('Cannot assign an archived task');
    }

    const participants = this.resolveParticipants(dto);
    for (const row of participants) {
      await this.assertCanAssign(
        membership,
        userId,
        row.userId,
        task.projectId,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.replaceParticipants(tx, task.id, participants);
      const primary = participants.find(
        (row) => row.role === TaskParticipantRole.ASSIGNEE,
      );
      return tx.task.update({
        where: { id: task.id },
        data: {
          ownerId: primary?.userId ?? null,
          assignedById: userId,
        },
        select: taskSelect,
      });
    });

    const response = this.toTaskResponse(updated);
    await this.notifyAssignment(membership.workspaceId, userId, response);
    return response;
  }

  async shareTask(
    membership: WorkspaceMembershipContext,
    actorId: string,
    taskId: string,
    dto: ShareTaskDto,
  ) {
    assertCanMutate(membership);
    const task = await this.requireVisibleTask(membership, actorId, taskId);
    await this.assertCanManageShare(membership, actorId, task);
    await this.assertAssigneeInWorkspace(membership.workspaceId, dto.userId);
    const share = await this.prisma.taskShare.upsert({
      where: { taskId_userId: { taskId: task.id, userId: dto.userId } },
      create: {
        workspaceId: membership.workspaceId,
        taskId: task.id,
        userId: dto.userId,
        permission: dto.permission,
      },
      update: { permission: dto.permission },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: [dto.userId],
      type: NotificationType.TASK_SHARED,
      title: 'A task was shared with you',
      message: task.title,
      entityId: task.id,
      entityType: 'task',
    });
    return share;
  }

  async unshareTask(
    membership: WorkspaceMembershipContext,
    actorId: string,
    taskId: string,
    userId: string,
  ) {
    const task = await this.requireVisibleTask(membership, actorId, taskId);
    await this.assertCanManageShare(membership, actorId, task);
    await this.prisma.taskShare.deleteMany({
      where: { taskId: task.id, userId },
    });
  }

  async updateVisibility(
    membership: WorkspaceMembershipContext,
    actorId: string,
    taskId: string,
    dto: UpdateTaskVisibilityDto,
  ) {
    const task = await this.requireVisibleTask(membership, actorId, taskId);
    await this.assertCanManageShare(membership, actorId, task);
    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { visibility: dto.visibility },
      select: taskSelect,
    });
    return this.toTaskResponse(updated);
  }

  async listShares(
    membership: WorkspaceMembershipContext,
    actorId: string,
    taskId: string,
  ) {
    const task = await this.requireVisibleTask(membership, actorId, taskId);
    return this.prisma.taskShare.findMany({
      where: { taskId: task.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async archive(membership: WorkspaceMembershipContext, taskId: string) {
    assertCanMutate(membership);
    const task = await this.requireTask(membership.workspaceId, taskId);
    if (task.status === TaskStatus.ARCHIVED) {
      return this.findById(membership, taskId);
    }
    assertValidTaskStatusTransition(task.status, TaskStatus.ARCHIVED);

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.ARCHIVED,
        preOverdueStatus:
          task.status === TaskStatus.OVERDUE ? null : task.preOverdueStatus,
      },
      select: taskSelect,
    });
    await this.refreshProjectStatus(membership.workspaceId, task.projectId);
    return this.toTaskResponse(updated);
  }

  async remove(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
  ) {
    assertCanMutate(membership);
    const task = await this.requireTask(membership.workspaceId, taskId);
    if (!canAdminister(membership.role) && task.assignedById !== userId) {
      throw new ForbiddenException('You can only delete tasks you created');
    }
    await this.prisma.task.delete({ where: { id: task.id } });
    await this.refreshProjectStatus(membership.workspaceId, task.projectId);
  }

  async listComments(membership: WorkspaceMembershipContext, taskId: string) {
    await this.requireTask(membership.workspaceId, taskId);
    const comments = await this.prisma.taskComment.findMany({
      where: { taskId, workspaceId: membership.workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        parentId: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
        reactions: { select: { emoji: true, userId: true } },
        files: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });
    return comments.map((comment) => this.toComment(comment));
  }

  async addComment(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    dto: CreateCommentDto,
  ) {
    assertCanMutate(membership);
    const task = await this.requireVisibleTask(membership, userId, taskId);
    await this.assertCanComment(membership, userId, task);
    if (dto.parentId) {
      const parent = await this.prisma.taskComment.findFirst({
        where: { id: dto.parentId, taskId },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('Reply target not found');
      }
    }
    const comment = await this.prisma.taskComment.create({
      data: {
        workspaceId: membership.workspaceId,
        taskId: task.id,
        authorId: userId,
        body: dto.body.trim(),
        parentId: dto.parentId ?? null,
      },
      select: {
        id: true,
        body: true,
        parentId: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
        reactions: { select: { emoji: true, userId: true } },
        files: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });

    const recipients = await this.taskRecipientIds(task.id);
    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: recipients.filter((id) => id !== userId),
      type: NotificationType.COMMENT_ADDED,
      title: `Comment on ${task.title}`,
      message: dto.body.trim().slice(0, 280),
      entityId: task.id,
      entityType: 'task',
    });
    const people = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: membership.workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    const mentioned = resolveMentionedUserIds(
      dto.body,
      people.map((item) => item.user),
    ).filter((id) => id !== userId);
    if (mentioned.length) {
      await this.notifications.notify({
        workspaceId: membership.workspaceId,
        userIds: mentioned,
        type: NotificationType.MENTION,
        title: 'You were mentioned',
        message: `${comment.author.name} mentioned you in a project`,
        entityId: task.id,
        entityType: 'task',
      });
    }
    const mapped = this.toComment(comment);
    this.realtime?.emitToTask(task.id, 'comment:new', {
      ...mapped,
      taskId: task.id,
    });
    await this.activity?.log({
      workspaceId: membership.workspaceId,
      actorId: userId,
      type: ActivityType.COMMENT_ADDED,
      title: `commented on a task`,
      entityType: 'task',
      entityId: task.id,
    });
    return mapped;
  }

  async reactToComment(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    commentId: string,
    emoji: string,
  ) {
    assertCanMutate(membership);
    await this.requireVisibleTask(membership, userId, taskId);
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId, workspaceId: membership.workspaceId },
      select: { id: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    const existing = await this.prisma.taskCommentReaction.findUnique({
      where: {
        commentId_userId_emoji: { commentId, userId, emoji },
      },
    });
    if (existing) {
      await this.prisma.taskCommentReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.taskCommentReaction.create({
        data: { commentId, userId, emoji },
      });
    }
    const comments = await this.listComments(membership, taskId);
    const updated = comments.find((item) => item.id === commentId);
    this.realtime?.emitToTask(taskId, 'comment:updated', updated);
    return updated;
  }

  private toComment(comment: {
    id: string;
    body: string;
    parentId: string | null;
    createdAt: Date;
    author: { id: string; name: string; email: string };
    reactions: Array<{ emoji: string; userId: string }>;
    files: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  }) {
    const grouped = new Map<string, string[]>();
    for (const reaction of comment.reactions) {
      grouped.set(reaction.emoji, [
        ...(grouped.get(reaction.emoji) ?? []),
        reaction.userId,
      ]);
    }
    return {
      id: comment.id,
      body: comment.body,
      parentId: comment.parentId,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
      files: comment.files,
      reactions: [...grouped.entries()].map(([emoji, userIds]) => ({
        emoji,
        userIds,
        count: userIds.length,
      })),
    };
  }

  async listSubtasks(membership: WorkspaceMembershipContext, taskId: string) {
    await this.requireTask(membership.workspaceId, taskId);
    const items = await this.prisma.task.findMany({
      where: { workspaceId: membership.workspaceId, parentId: taskId },
      select: taskSelect,
      orderBy: { createdAt: 'asc' },
    });
    return items.map((item) => this.toTaskResponse(item));
  }

  async submit(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    dto: SubmitTaskDto,
  ) {
    assertCanMutate(membership);
    const task = await this.requireTask(membership.workspaceId, taskId);
    await this.assertIsAssignee(task.id, userId);
    await this.assertNotBlocked(membership, task.id);
    const mine = await this.prisma.taskSubmission.findFirst({
      where: { taskId: task.id, submitterId: userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    if (mine?.status === SubmissionStatus.SUBMITTED) {
      throw new BadRequestException(
        'You already submitted. Wait for review before submitting again.',
      );
    }
    if (mine?.status === SubmissionStatus.APPROVED) {
      throw new BadRequestException(
        'Your work on this task is already approved.',
      );
    }
    const submittable =
      SUBMITTABLE_STATUSES.includes(task.status) ||
      (task.status === TaskStatus.COMPLETED &&
        (await this.resolveCollaborativeStatus(this.prisma, task)) !==
          TaskStatus.COMPLETED);
    if (!submittable) {
      throw new BadRequestException(
        'Work can only be submitted while in progress, returned, overdue, or under review',
      );
    }
    const fileIds = [...new Set(dto.fileIds ?? [])];
    const files = fileIds.length
      ? await this.prisma.workspaceFile.findMany({
          where: {
            id: { in: fileIds },
            workspaceId: membership.workspaceId,
            taskId: task.id,
          },
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
        })
      : [];
    if (files.length !== fileIds.length) {
      throw new BadRequestException(
        'Every deliverable must be a file attached to this task',
      );
    }

    const previous = await this.prisma.taskSubmission.count({
      where: { taskId: task.id, submitterId: userId },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.taskSubmission.create({
        data: {
          workspaceId: membership.workspaceId,
          taskId: task.id,
          submitterId: userId,
          note: dto.note?.trim() || null,
          deliverables: dto.deliverables?.trim() || null,
          justification: dto.justification?.trim() || null,
          version: previous + 1,
        },
      });
      if (files.length) {
        await tx.taskSubmissionFile.createMany({
          data: files.map((file) => ({
            submissionId: submission.id,
            fileUrl: file.id,
            fileName: file.originalName,
            fileType: file.mimeType,
            fileSize: file.sizeBytes,
          })),
        });
      }
      const nextStatus = await this.resolveCollaborativeStatus(tx, task);
      return tx.task.update({
        where: { id: task.id },
        data: { status: nextStatus },
        select: taskSelect,
      });
    });

    const reviewerId = await this.resolveReviewerId({
      workspaceId: membership.workspaceId,
      assignedById: task.assignedById,
      projectId: task.projectId,
      ownerId: task.ownerId,
    });
    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: [reviewerId].filter((id): id is string => Boolean(id) && id !== userId),
      type: NotificationType.TASK_SUBMITTED,
      title: 'Task submitted for review',
      message: updated.title,
      entityId: task.id,
      entityType: 'task',
    });
    await this.refreshProjectStatus(membership.workspaceId, task.projectId);
    return this.respondWithSubmissionFiles(updated);
  }

  async review(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    dto: ReviewSubmissionDto,
  ) {
    assertCanMutate(membership);
    if (dto.status === SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('Review must approve or return the work');
    }
    if (dto.status === SubmissionStatus.RETURNED && !dto.note?.trim()) {
      throw new BadRequestException('A comment is required when returning work');
    }
    const task = await this.requireTask(membership.workspaceId, taskId);
    if (task.status !== TaskStatus.IN_REVIEW) {
      throw new BadRequestException('Only work under review can be approved or returned');
    }
    await this.assertCanReview(membership, userId, task);

    const submission = dto.submissionId
      ? await this.prisma.taskSubmission.findFirst({
          where: { id: dto.submissionId, taskId: task.id },
        })
      : await this.prisma.taskSubmission.findFirst({
          where: { taskId: task.id, status: SubmissionStatus.SUBMITTED },
          orderBy: { createdAt: 'desc' },
        });
    if (
      !submission ||
      (submission.status !== SubmissionStatus.SUBMITTED &&
        dto.status !== SubmissionStatus.APPROVED)
    ) {
      throw new BadRequestException('No pending submission to review');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (submission.status === SubmissionStatus.SUBMITTED) {
        await tx.taskSubmission.update({
          where: { id: submission.id },
          data: {
            status: dto.status,
            reviewNote: dto.note?.trim() || null,
            reviewerId: userId,
            reviewedAt: new Date(),
          },
        });
      }

      const nextStatus = await this.resolveCollaborativeStatus(tx, {
        id: task.id,
        ownerId: task.ownerId,
        status: task.status,
      });

      return tx.task.update({
        where: { id: task.id },
        data: {
          status: nextStatus,
          ...(nextStatus === TaskStatus.COMPLETED
            ? { approvedAt: new Date(), approvedById: userId }
            : { approvedAt: null, approvedById: null }),
        },
        select: taskSelect,
      });
    });

    try {
      await this.notifications.notify({
        workspaceId: membership.workspaceId,
        userIds: [submission.submitterId].filter((id) => id !== userId),
        type:
          dto.status === SubmissionStatus.APPROVED
            ? NotificationType.TASK_APPROVED
            : NotificationType.TASK_SUBMISSION_RETURNED,
        title:
          dto.status === SubmissionStatus.APPROVED
            ? 'Work approved'
            : 'Work returned',
        message: dto.note?.trim() || updated.title,
        entityId: task.id,
        entityType: 'task',
      });
    } catch {
      // Status is already saved.
    }

    if (updated.status === TaskStatus.COMPLETED) {
      try {
        await this.spawnRecurrence(membership, userId, updated.id);
        await this.automations.dispatch({
          workspaceId: membership.workspaceId,
          trigger: AutomationTrigger.TASK_COMPLETED,
          actorUserId: userId,
          ownerId: updated.ownerId,
          assigneeIds: updated.assignees.map((item) => item.user.id),
          title: `Task completed: ${updated.title}`,
          entityId: updated.id,
          entityType: 'task',
        });
      } catch {
        // Status is already saved.
      }
    }

    await this.refreshProjectStatus(membership.workspaceId, task.projectId);
    if (dto.status === SubmissionStatus.APPROVED) {
      await this.activity?.log({
        workspaceId: membership.workspaceId,
        actorId: userId,
        type: ActivityType.TASK_APPROVED,
        title: `approved task`,
        entityType: 'task',
        entityId: task.id,
      });
    }
    return this.respondWithSubmissionFiles(updated);
  }

  async returnToLeader(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    dto: ReturnTaskDto,
  ) {
    assertCanMutate(membership);
    const task = await this.requireTask(membership.workspaceId, taskId);
    await this.assertIsAssignee(task.id, userId);
    const leaderId = await this.resolveReviewerId({
      workspaceId: membership.workspaceId,
      assignedById: task.assignedById,
      projectId: task.projectId,
      ownerId: task.ownerId,
    });
    if (!leaderId) {
      throw new BadRequestException('No leader is available for this task');
    }
    const record = await this.prisma.taskReturn.create({
      data: {
        taskId: task.id,
        memberId: userId,
        leaderId,
        comment: dto.comment.trim(),
      },
    });
    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: [leaderId],
      type: NotificationType.TASK_RETURNED,
      title: 'Task returned to leader',
      message: dto.comment.trim().slice(0, 280),
      entityId: task.id,
      entityType: 'task',
    });
    return record;
  }

  async startTimer(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
  ) {
    assertCanMutate(membership);
    const task = await this.requireTask(membership.workspaceId, taskId);
    const open = await this.prisma.timeEntry.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        userId,
        endedAt: null,
      },
    });
    if (open) {
      throw new BadRequestException('Stop the running timer before starting another');
    }
    return this.prisma.timeEntry.create({
      data: {
        workspaceId: membership.workspaceId,
        taskId: task.id,
        userId,
        startedAt: new Date(),
      },
    });
  }

  async stopTimer(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
  ) {
    assertCanMutate(membership);
    await this.requireTask(membership.workspaceId, taskId);
    const open = await this.prisma.timeEntry.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        taskId,
        userId,
        endedAt: null,
      },
    });
    if (!open) {
      throw new BadRequestException('No running timer on this task');
    }
    const endedAt = new Date();
    const minutes = Math.max(
      1,
      Math.round((endedAt.getTime() - open.startedAt.getTime()) / 60000),
    );
    return this.prisma.timeEntry.update({
      where: { id: open.id },
      data: { endedAt, minutes },
    });
  }

  async applySchedule(
    membership: WorkspaceMembershipContext,
    dto: ApplyScheduleDto,
  ) {
    assertCanMutate(membership);
    const ids = dto.items.map((item) => item.taskId);
    const found = await this.prisma.task.findMany({
      where: { workspaceId: membership.workspaceId, id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Every scheduled task must belong to this workspace');
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.task.update({
          where: { id: item.taskId },
          data: {
            scheduledStart: new Date(item.scheduledStart),
            scheduledEnd: new Date(item.scheduledEnd),
          },
        }),
      ),
    );

    const items = await this.prisma.task.findMany({
      where: { workspaceId: membership.workspaceId, id: { in: ids } },
      select: taskSelect,
    });
    return items.map((item) => this.toTaskResponse(item));
  }

  async spawnDueRecurrences() {
    const due = await this.prisma.task.findMany({
      where: {
        recurrence: { not: null },
        status: TaskStatus.COMPLETED,
        recurrenceAnchor: { lte: new Date() },
      },
      select: {
        id: true,
        workspaceId: true,
        ownerId: true,
        recurrence: true,
        recurrenceAnchor: true,
      },
      take: 50,
    });
    for (const task of due) {
      if (!task.ownerId || !task.recurrence) {
        continue;
      }
      await this.spawnRecurrence(
        {
          workspaceId: task.workspaceId,
          memberId: 'system',
          role: WorkspaceRole.OWNER,
        },
        task.ownerId,
        task.id,
      );
    }
  }

  private buildListWhere(
    membership: WorkspaceMembershipContext,
    userId: string,
    query: ListTasksQueryDto,
  ): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = { workspaceId: membership.workspaceId };

    if (query.status) {
      where.status = query.status;
    } else if (!query.includeArchived) {
      where.status = { not: TaskStatus.ARCHIVED };
    }

    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.milestoneId) {
      where.milestoneId = query.milestoneId;
    }
    if (query.assigneeId) {
      where.assignees = { some: { userId: query.assigneeId } };
    }
    if (query.mine) {
      where.OR = [
        { ownerId: userId },
        { assignees: { some: { userId } } },
      ];
    }
    if (query.parentId === 'none') {
      where.parentId = null;
    } else if (query.parentId) {
      where.parentId = query.parentId;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      const search = [
        { title: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ];
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        { OR: search },
      ];
    }

    if (!canAdminister(membership.role)) {
      const visibilityFilter: Prisma.TaskWhereInput = {
        OR: [
          { visibility: TaskVisibility.WORKSPACE },
          {
            visibility: TaskVisibility.PROJECT,
            OR: [
              { project: { ownerId: userId } },
              { project: { assignments: { some: { userId } } } },
              { ownerId: userId },
              { assignedById: userId },
              { assignees: { some: { userId } } },
              { shares: { some: { userId } } },
            ],
          },
          {
            visibility: TaskVisibility.PRIVATE,
            OR: [
              { ownerId: userId },
              { assignedById: userId },
              { assignees: { some: { userId } } },
              { shares: { some: { userId } } },
              { project: { ownerId: userId } },
            ],
          },
        ],
      };
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        visibilityFilter,
      ];
    }

    return where;
  }

  async markOverdue(workspaceId?: string) {
    const now = new Date();
    if (workspaceId) {
      await this.prisma.$executeRaw`
        UPDATE tasks
        SET "preOverdueStatus" = status,
            status = 'OVERDUE'::"TaskStatus"
        WHERE "workspaceId" = ${workspaceId}
          AND status IN (
            'TODO'::"TaskStatus",
            'IN_PROGRESS'::"TaskStatus",
            'RETURNED'::"TaskStatus"
          )
          AND "dueDate" < ${now}
          AND NOT EXISTS (
            SELECT 1 FROM task_submissions s WHERE s."taskId" = tasks.id
          )
      `;
      return;
    }
    await this.prisma.$executeRaw`
      UPDATE tasks
      SET "preOverdueStatus" = status,
          status = 'OVERDUE'::"TaskStatus"
      WHERE status IN (
          'TODO'::"TaskStatus",
          'IN_PROGRESS'::"TaskStatus",
          'RETURNED'::"TaskStatus"
        )
        AND "dueDate" < ${now}
        AND NOT EXISTS (
          SELECT 1 FROM task_submissions s WHERE s."taskId" = tasks.id
        )
    `;
  }

  private async completeApprovedReview(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        workspaceId,
        status: { in: [TaskStatus.IN_REVIEW, TaskStatus.COMPLETED] },
      },
      select: { id: true, projectId: true, ownerId: true, status: true },
    });
    if (!task) {
      return;
    }
    const nextStatus = await this.resolveCollaborativeStatus(this.prisma, task);
    if (nextStatus === task.status) {
      return;
    }
    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        ...(nextStatus === TaskStatus.COMPLETED
          ? {}
          : { approvedAt: null, approvedById: null }),
      },
    });
    await this.refreshProjectStatus(workspaceId, task.projectId);
  }

  private async persistCollaborativeStatuses(
    items: Array<{
      id: string;
      status: TaskStatus;
      ownerId: string | null;
      assignees?: Array<{
        userId?: string;
        role?: TaskParticipantRole | null;
        user: { id: string };
      }>;
      submissions?: Array<{
        submitterId: string;
        status: SubmissionStatus;
      }>;
    }>,
  ) {
    for (const item of items) {
      const nextStatus = this.collaborativeStatusFromRecord(item);
      if (nextStatus === item.status) {
        continue;
      }
      await this.prisma.task.update({
        where: { id: item.id },
        data: {
          status: nextStatus,
          ...(nextStatus === TaskStatus.COMPLETED
            ? {}
            : { approvedAt: null, approvedById: null }),
        },
      });
      item.status = nextStatus;
    }
  }

  private collaborativeStatusFromRecord(task: {
    status: TaskStatus;
    ownerId: string | null;
    assignees?: Array<{
      userId?: string;
      role?: TaskParticipantRole | null;
      user: { id: string };
    }>;
    submissions?: Array<{ submitterId: string; status: SubmissionStatus }>;
  }) {
    const assigneeIds = [
      ...new Set(
        (task.assignees ?? [])
          .filter(
            (row) =>
              !row.role || row.role === TaskParticipantRole.ASSIGNEE,
          )
          .map((row) => row.userId ?? row.user.id)
          .filter(Boolean),
      ),
    ];
    const ids = assigneeIds.length
      ? assigneeIds
      : task.ownerId
        ? [task.ownerId]
        : [];
    const latest = new Map<string, SubmissionStatus>();
    for (const row of task.submissions ?? []) {
      if (!latest.has(row.submitterId)) {
        latest.set(row.submitterId, row.status);
      }
    }
    return resolveCollaborativeTaskStatus(ids, latest, task.status);
  }

  private async resolveCollaborativeStatus(
    db: Pick<Prisma.TransactionClient, 'taskAssignee' | 'taskSubmission'>,
    task: { id: string; ownerId: string | null; status: TaskStatus },
  ) {
    const assigneeRows = await db.taskAssignee.findMany({
      where: { taskId: task.id, role: TaskParticipantRole.ASSIGNEE },
      select: { userId: true },
    });
    const assigneeIds = [
      ...new Set(
        [
          ...assigneeRows.map((row) => row.userId),
          ...(assigneeRows.length || !task.ownerId ? [] : [task.ownerId]),
        ].filter(Boolean),
      ),
    ];
    const submissions = await db.taskSubmission.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: 'desc' },
      select: { submitterId: true, status: true },
    });
    const latest = new Map<string, SubmissionStatus>();
    for (const row of submissions) {
      if (!latest.has(row.submitterId)) {
        latest.set(row.submitterId, row.status);
      }
    }
    return resolveCollaborativeTaskStatus(assigneeIds, latest, task.status);
  }

  private async requireTask(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        assignedById: true,
        startedAt: true,
        preOverdueStatus: true,
        dueDate: true,
        recurrence: true,
        recurrenceAnchor: true,
        description: true,
        priority: true,
        projectId: true,
        parentId: true,
        estimatedMinutes: true,
      },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async assertUsableProject(workspaceId: string, projectId: string) {
    const project = await this.projectsService.assertProjectInWorkspace(
      workspaceId,
      projectId,
    );
    if (project.status === ProjectStatus.ARCHIVED) {
      throw new BadRequestException('Cannot use an archived project');
    }
  }

  private async assertAssigneeInWorkspace(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new BadRequestException('Assignee must be a workspace member');
    }
  }

  private resolveAssigneeIds(
    assigneeId?: string | null,
    assigneeIds?: string[],
  ) {
    return [
      ...new Set(
        [assigneeId, ...(assigneeIds ?? [])].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
  }

  private resolveParticipants(dto: {
    assigneeId?: string | null;
    assigneeIds?: string[];
    collaboratorIds?: string[];
    watcherIds?: string[];
  }) {
    const seen = new Set<string>();
    const rows: Array<{ userId: string; role: TaskParticipantRole }> = [];
    const push = (ids: string[], role: TaskParticipantRole) => {
      for (const userId of ids) {
        if (!userId || seen.has(userId)) {
          continue;
        }
        seen.add(userId);
        rows.push({ userId, role });
      }
    };
    push(this.resolveAssigneeIds(dto.assigneeId, dto.assigneeIds), TaskParticipantRole.ASSIGNEE);
    push(dto.collaboratorIds ?? [], TaskParticipantRole.COLLABORATOR);
    push(dto.watcherIds ?? [], TaskParticipantRole.WATCHER);
    return rows;
  }

  private participantCreates(dto: {
    assigneeId?: string | null;
    assigneeIds?: string[];
    collaboratorIds?: string[];
    watcherIds?: string[];
  }) {
    return this.resolveParticipants(dto).map((row) => ({
      userId: row.userId,
      role: row.role,
    }));
  }

  private async replaceParticipants(
    tx: Prisma.TransactionClient,
    taskId: string,
    participants: Array<{ userId: string; role: TaskParticipantRole }>,
  ) {
    await tx.taskAssignee.deleteMany({ where: { taskId } });
    for (const row of participants) {
      await tx.taskAssignee.create({
        data: { taskId, userId: row.userId, role: row.role },
      });
    }
  }

  private async assertCanAssign(
    membership: WorkspaceMembershipContext,
    actorId: string,
    assigneeId: string,
    projectId: string | null,
  ) {
    await this.assertAssigneeInWorkspace(membership.workspaceId, assigneeId);
    if (canAdminister(membership.role) || assigneeId === actorId || projectId) {
      return;
    }
    const shared = await this.prisma.teamMember.findFirst({
      where: {
        userId: actorId,
        team: {
          workspaceId: membership.workspaceId,
          members: { some: { userId: assigneeId } },
        },
      },
      select: { id: true },
    });
    if (!shared) {
      throw new ForbiddenException(
        'Members can only assign standalone tasks to people on their team',
      );
    }
  }

  private async assertIsAssignee(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId },
      select: {
        ownerId: true,
        assignees: { select: { userId: true, role: true } },
      },
    });
    const assigned =
      task?.ownerId === userId ||
      task?.assignees.some(
        (item) =>
          item.userId === userId &&
          item.role === TaskParticipantRole.ASSIGNEE,
      );
    if (!assigned) {
      throw new ForbiddenException('Only an assignee can do this');
    }
  }

  private async assertCanStart(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
    fromStatus: TaskStatus,
  ) {
    if (
      fromStatus !== TaskStatus.TODO &&
      fromStatus !== TaskStatus.RETURNED &&
      fromStatus !== TaskStatus.OVERDUE
    ) {
      throw new BadRequestException('This task cannot be started from its current status');
    }
    if (!canAdminister(membership.role)) {
      await this.assertIsAssignee(taskId, userId);
    }
    await this.assertNotBlocked(membership, taskId);
  }

  private async assertNotBlocked(
    membership: WorkspaceMembershipContext,
    taskId: string,
  ) {
    if (canAdminister(membership.role)) {
      return;
    }
    const titles = await this.unfinishedBlockerTitles(taskId);
    if (titles.length) {
      throw new BadRequestException(
        `Blocked by unfinished work: ${titles.join(', ')}`,
      );
    }
  }

  private async unfinishedBlockerTitles(taskId: string): Promise<string[]> {
    const [depends, blockedByIncoming] = await Promise.all([
      this.prisma.taskDependency.findMany({
        where: {
          fromTaskId: taskId,
          type: { in: [DependencyType.DEPENDS_ON, DependencyType.BLOCKED_BY] },
          toTask: {
            status: { notIn: [TaskStatus.COMPLETED, TaskStatus.ARCHIVED] },
          },
        },
        select: { toTask: { select: { title: true } } },
      }),
      this.prisma.taskDependency.findMany({
        where: {
          toTaskId: taskId,
          type: DependencyType.BLOCKS,
          fromTask: {
            status: { notIn: [TaskStatus.COMPLETED, TaskStatus.ARCHIVED] },
          },
        },
        select: { fromTask: { select: { title: true } } },
      }),
    ]);
    return [
      ...depends.map((item) => item.toTask.title),
      ...blockedByIncoming.map((item) => item.fromTask.title),
    ];
  }

  private async assertCanReview(
    membership: WorkspaceMembershipContext,
    userId: string,
    task: { assignedById: string | null; projectId: string | null; ownerId: string | null },
  ) {
    if (canAdminister(membership.role)) {
      return;
    }
    const reviewerId = await this.resolveReviewerId({
      workspaceId: membership.workspaceId,
      assignedById: task.assignedById,
      projectId: task.projectId,
      ownerId: task.ownerId,
    });
    if (reviewerId !== userId) {
      throw new ForbiddenException('Only the assigned reviewer can review this work');
    }
  }

  private async resolveReviewerId(task: {
    workspaceId: string;
    assignedById: string | null;
    projectId: string | null;
    ownerId: string | null;
  }): Promise<string | null> {
    if (task.assignedById) {
      return task.assignedById;
    }
    if (task.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: task.projectId, workspaceId: task.workspaceId },
        select: { ownerId: true },
      });
      if (project?.ownerId) {
        return project.ownerId;
      }
    }
    if (task.ownerId) {
      const team = await this.prisma.teamMember.findFirst({
        where: {
          userId: task.ownerId,
          team: { workspaceId: task.workspaceId },
        },
        select: { team: { select: { ownerId: true } } },
      });
      if (team?.team.ownerId) {
        return team.team.ownerId;
      }
    }
    const owner = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: task.workspaceId,
        role: WorkspaceRole.OWNER,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { userId: true },
    });
    return owner?.userId ?? null;
  }

  private async replaceDependsOn(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    taskId: string,
    dependsOnTaskIds: string[],
  ) {
    const unique = [
      ...new Set(dependsOnTaskIds.filter((id) => id && id !== taskId)),
    ];
    if (unique.length) {
      const found = await tx.task.findMany({
        where: { workspaceId, id: { in: unique } },
        select: { id: true },
      });
      if (found.length !== unique.length) {
        throw new BadRequestException(
          'Dependencies must be tasks in this workspace',
        );
      }
    }

    await tx.taskDependency.deleteMany({
      where: {
        fromTaskId: taskId,
        type: {
          in: [DependencyType.DEPENDS_ON, DependencyType.BLOCKED_BY],
        },
      },
    });

    for (const toTaskId of unique) {
      await tx.taskDependency.create({
        data: {
          workspaceId,
          fromTaskId: taskId,
          toTaskId,
          type: DependencyType.DEPENDS_ON,
        },
      });
    }
  }

  private async replaceBlocks(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    taskId: string,
    blocksTaskIds: string[],
  ) {
    const unique = [
      ...new Set(blocksTaskIds.filter((id) => id && id !== taskId)),
    ];
    if (unique.length) {
      const found = await tx.task.findMany({
        where: { workspaceId, id: { in: unique } },
        select: { id: true },
      });
      if (found.length !== unique.length) {
        throw new BadRequestException(
          'Blocked tasks must be tasks in this workspace',
        );
      }
    }

    await tx.taskDependency.deleteMany({
      where: {
        fromTaskId: taskId,
        type: DependencyType.BLOCKS,
      },
    });

    for (const toTaskId of unique) {
      await tx.taskDependency.create({
        data: {
          workspaceId,
          fromTaskId: taskId,
          toTaskId,
          type: DependencyType.BLOCKS,
        },
      });
    }
  }

  private async assertMilestone(
    workspaceId: string,
    milestoneId: string,
    projectId: string | null,
  ) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, workspaceId },
      select: { id: true, projectId: true },
    });
    if (!milestone) {
      throw new BadRequestException('Milestone not found in this workspace');
    }
    if (
      milestone.projectId &&
      projectId &&
      milestone.projectId !== projectId
    ) {
      throw new BadRequestException(
        'Milestone must belong to the same project as the task',
      );
    }
    return milestone.id;
  }

  private async respondWithSubmissionFiles(task: TaskRecord) {
    const response = this.toTaskResponse(task);
    const submissions = response.submissions;
    if (!submissions.length) {
      return {
        ...response,
        submissions: submissions.map((item) => ({ ...item, files: [] })),
      };
    }

    const links = await this.prisma.taskSubmissionFile.findMany({
      where: { submissionId: { in: submissions.map((item) => item.id) } },
    });
    const storedNames = [...new Set(links.map((link) => link.fileUrl))];
    const workspaceFiles = storedNames.length
      ? await this.prisma.workspaceFile.findMany({
          where: {
            taskId: task.id,
            OR: [
              { filename: { in: storedNames } },
              { id: { in: storedNames } },
            ],
          },
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
        })
      : [];
    const byStored = new Map<
      string,
      (typeof workspaceFiles)[number]
    >();
    for (const file of workspaceFiles) {
      byStored.set(file.filename, file);
      byStored.set(file.id, file);
    }

    const filesBySubmission = new Map<
      string,
      Array<{
        id: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
      }>
    >();
    for (const link of links) {
      const file = byStored.get(link.fileUrl);
      const item = {
        id: file?.id ?? link.id,
        originalName: file?.originalName ?? link.fileName,
        mimeType: file?.mimeType ?? link.fileType,
        sizeBytes: file?.sizeBytes ?? link.fileSize,
      };
      const current = filesBySubmission.get(link.submissionId) ?? [];
      current.push(item);
      filesBySubmission.set(link.submissionId, current);
    }

    return {
      ...response,
      submissions: submissions.map((item) => ({
        ...item,
        files: filesBySubmission.get(item.id) ?? [],
      })),
    };
  }

  private toTaskResponse(task: TaskRecord) {
    const {
      assignees = [],
      outgoingDependencies = [],
      incomingDependencies = [],
      estimatedMinutes,
      submissions = [],
      shares = [],
      ...rest
    } = task;
    const withRole = assignees.map((item) => ({
      ...item.user,
      role: item.role ?? TaskParticipantRole.ASSIGNEE,
    }));
    const assigneePeople = withRole.filter(
      (person) => person.role === TaskParticipantRole.ASSIGNEE,
    );
    const collaborators = withRole.filter(
      (person) => person.role === TaskParticipantRole.COLLABORATOR,
    );
    const watchers = withRole.filter(
      (person) => person.role === TaskParticipantRole.WATCHER,
    );
    const people = assigneePeople.length ? assigneePeople : withRole;
    const primary =
      people.find((person) => person.id === task.ownerId) ?? people[0] ?? null;
    const assigneeIds = [
      ...new Set(
        people.map((person) => person.id).filter((id): id is string => Boolean(id)),
      ),
    ];
    const latestByUser = new Map<string, (typeof submissions)[number]>();
    for (const submission of submissions) {
      if (!latestByUser.has(submission.submitterId)) {
        latestByUser.set(submission.submitterId, submission);
      }
    }
    const submitted = assigneeIds.filter((id) => {
      const value = latestByUser.get(id)?.status;
      return (
        value === SubmissionStatus.SUBMITTED ||
        value === SubmissionStatus.APPROVED
      );
    }).length;
    const approved = assigneeIds.filter(
      (id) => latestByUser.get(id)?.status === SubmissionStatus.APPROVED,
    ).length;
    const returned = submissions.find(
      (item) => item.status === SubmissionStatus.RETURNED,
    );
    const isOpen = (status: TaskStatus) =>
      status !== TaskStatus.COMPLETED && status !== TaskStatus.ARCHIVED;
    const dependsOn = outgoingDependencies
      .filter(
        (edge) =>
          !('type' in edge) ||
          !edge.type ||
          edge.type === DependencyType.DEPENDS_ON ||
          edge.type === DependencyType.BLOCKED_BY,
      )
      .map((edge) => edge.toTask);
    const blockedBy = [
      ...outgoingDependencies
        .filter(
          (edge) =>
            (!edge.type ||
              edge.type === DependencyType.DEPENDS_ON ||
              edge.type === DependencyType.BLOCKED_BY) &&
            isOpen(edge.toTask.status),
        )
        .map((edge) => edge.toTask),
      ...incomingDependencies
        .filter(
          (edge) =>
            edge.type === DependencyType.BLOCKS && isOpen(edge.fromTask.status),
        )
        .map((edge) => edge.fromTask),
    ];
    const blocks = [
      ...outgoingDependencies
        .filter((edge) => edge.type === DependencyType.BLOCKS)
        .map((edge) => edge.toTask),
      ...incomingDependencies
        .filter(
          (edge) =>
            !edge.type ||
            edge.type === DependencyType.DEPENDS_ON ||
            edge.type === DependencyType.BLOCKED_BY,
        )
        .map((edge) => edge.fromTask),
    ];
    const seenBlocked = new Set<string>();
    const uniqueBlockedBy = blockedBy.filter((item) => {
      if (seenBlocked.has(item.id)) return false;
      seenBlocked.add(item.id);
      return true;
    });
    const seenBlocks = new Set<string>();
    const uniqueBlocks = blocks.filter((item) => {
      if (seenBlocks.has(item.id)) return false;
      seenBlocks.add(item.id);
      return true;
    });
    return {
      ...rest,
      estimatedHours:
        estimatedMinutes == null ? null : hoursFromMinutes(estimatedMinutes),
      assignee: primary,
      assignees: people,
      collaborators,
      watchers,
      shares,
      submissions: submissions.map((item) => ({ ...item, files: [] })),
      submissionProgress: {
        submitted,
        approved,
        total: Math.max(assigneeIds.length, 0),
      },
      assigneeWork: people.map((person) => ({
        userId: person.id,
        name: person.name,
        status: latestByUser.get(person.id)?.status ?? 'NOT_STARTED',
      })),
      latestReturnComment: returned?.reviewNote ?? null,
      dependsOn,
      blockedBy: uniqueBlockedBy,
      blocks: uniqueBlocks,
      blocked: uniqueBlockedBy.length > 0,
    };
  }

  private async assertParent(workspaceId: string, parentId: string) {
    const parent = await this.prisma.task.findFirst({
      where: { id: parentId, workspaceId },
      select: { id: true, parentId: true },
    });
    if (!parent) {
      throw new BadRequestException('Parent task must be in this workspace');
    }
    if (parent.parentId) {
      throw new BadRequestException('Subtasks cannot be nested further');
    }
  }

  private async taskRecipientIds(taskId: string): Promise<string[]> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId },
      select: {
        ownerId: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!task) {
      return [];
    }
    return [
      ...new Set(
        [task.ownerId, ...task.assignees.map((item) => item.userId)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
  }

  private async notifyAssignment(
    workspaceId: string,
    actorId: string,
    task: {
      id: string;
      title: string;
      assignee: { id: string } | null;
      assignees?: Array<{ id: string }>;
    },
  ) {
    const userIds = [
      ...new Set(
        [task.assignee, ...(task.assignees ?? [])]
          .filter((person): person is { id: string } => Boolean(person))
          .map((person) => person.id)
          .filter((id) => id !== actorId),
      ),
    ];
    if (userIds.length === 0) {
      return;
    }
    await this.notifications.notify({
      workspaceId,
      userIds,
      type: NotificationType.TASK_ASSIGNED,
      title: 'You were assigned',
      message: task.title,
      entityId: task.id,
      entityType: 'task',
    });
  }

  private async spawnRecurrence(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
  ) {
    const source = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId: membership.workspaceId },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        projectId: true,
        ownerId: true,
        dueDate: true,
        estimatedMinutes: true,
        recurrence: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!source?.recurrence) {
      return;
    }

    const nextDue = nextRecurrenceDate(
      source.dueDate ?? new Date(),
      source.recurrence,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: source.id },
        data: { recurrence: null, recurrenceAnchor: null },
      });
      await tx.task.create({
        data: {
          title: source.title,
          description: source.description,
          priority: source.priority,
          projectId: source.projectId,
          workspaceId: membership.workspaceId,
          ownerId: source.ownerId ?? userId,
          dueDate: nextDue,
          estimatedMinutes: source.estimatedMinutes,
          recurrence: source.recurrence,
          recurrenceAnchor: nextDue,
          status: TaskStatus.TODO,
          assignees: source.assignees.length
            ? { create: source.assignees.map((item) => ({ userId: item.userId })) }
            : undefined,
        },
      });
    });
    await this.refreshProjectStatus(membership.workspaceId, source.projectId);
  }

  private async refreshProjectStatus(
    workspaceId: string,
    projectId: string | null,
  ) {
    if (!projectId) {
      return;
    }
    await this.projectsService.syncDerivedStatus(workspaceId, projectId);
  }

  private async requireVisibleTask(
    membership: WorkspaceMembershipContext,
    userId: string,
    taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId: membership.workspaceId },
      select: {
        id: true,
        title: true,
        visibility: true,
        ownerId: true,
        assignedById: true,
        projectId: true,
        assignees: { select: { userId: true, role: true } },
        shares: { select: { userId: true, permission: true } },
      },
    });
    if (!task || !(await this.canViewTask(membership, userId, task))) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async canViewTask(
    membership: WorkspaceMembershipContext,
    userId: string,
    task: {
      visibility: TaskVisibility;
      ownerId: string | null;
      assignedById: string | null;
      projectId: string | null;
      assignees?: Array<{ userId?: string; user?: { id: string } }>;
      shares?: Array<{ userId: string }>;
    },
  ) {
    if (canAdminister(membership.role)) {
      return true;
    }
    const participant =
      task.ownerId === userId ||
      task.assignedById === userId ||
      (task.assignees ?? []).some(
        (item) => item.userId === userId || item.user?.id === userId,
      ) ||
      (task.shares ?? []).some((item) => item.userId === userId);
    if (participant) {
      return true;
    }
    if (task.visibility === TaskVisibility.WORKSPACE) {
      return true;
    }
    if (task.visibility === TaskVisibility.PROJECT && task.projectId) {
      const access = await this.projectsService.resolveAccess(
        membership,
        userId,
        task.projectId,
      );
      return access !== 'NONE';
    }
    if (task.visibility === TaskVisibility.PRIVATE && task.projectId) {
      const access = await this.projectsService.resolveAccess(
        membership,
        userId,
        task.projectId,
      );
      return access === 'OWN' || access === 'MANAGE';
    }
    return false;
  }

  private async assertCanComment(
    membership: WorkspaceMembershipContext,
    userId: string,
    task: {
      assignedById: string | null;
      ownerId: string | null;
      assignees?: Array<{ userId: string }>;
      shares?: Array<{ userId: string; permission: TaskSharePermission }>;
    },
  ) {
    if (canAdminister(membership.role) || task.assignedById === userId) {
      return;
    }
    const share = task.shares?.find((item) => item.userId === userId);
    if (share && !shareAllowsComment(share.permission)) {
      throw new ForbiddenException('You can view this task but not comment');
    }
  }

  private async assertCanManageShare(
    membership: WorkspaceMembershipContext,
    userId: string,
    task: { assignedById: string | null; ownerId: string | null },
  ) {
    if (canAdminister(membership.role) || task.assignedById === userId) {
      return;
    }
    throw new ForbiddenException('You cannot share this task');
  }
}

function nextRecurrenceDate(from: Date, rule: string): Date {
  const next = new Date(from);
  if (rule === RecurrenceRule.DAILY) {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (rule === RecurrenceRule.WEEKLY) {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}
