import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ProjectStatus,
  SubmissionStatus,
  TaskStatus,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from '../automations/automations.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { TasksService } from './tasks.service';

const memberMembership: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.MEMBER,
};

const adminMembership: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-admin',
  role: WorkspaceRole.ADMIN,
};

describe('TasksService', () => {
  let service: TasksService;
  const prisma = {
    task: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    taskAssignee: { deleteMany: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    taskDependency: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    taskComment: { findMany: jest.fn(), create: jest.fn() },
    taskSubmission: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    taskSubmissionFile: { createMany: jest.fn(), findMany: jest.fn() },
    taskReturn: { create: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    workspaceFile: { findMany: jest.fn() },
    project: { findFirst: jest.fn() },
    timeEntry: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    workspaceMember: { findUnique: jest.fn(), findFirst: jest.fn() },
    taskShare: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const projectsService = {
    assertProjectInWorkspace: jest.fn(),
    syncDerivedStatus: jest.fn(),
    resolveAccess: jest.fn().mockResolvedValue('EDIT'),
  };
  const notifications = { notify: jest.fn() };
  const automations = { dispatch: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    prisma.$executeRaw.mockResolvedValue(0);
    prisma.taskSubmissionFile.findMany.mockResolvedValue([]);
    prisma.taskDependency.findMany.mockResolvedValue([]);
    prisma.taskAssignee.findMany.mockResolvedValue([]);
    prisma.taskSubmission.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projectsService },
        { provide: NotificationsService, useValue: notifications },
        { provide: AutomationsService, useValue: automations },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('scopes task lists to the membership workspace', async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    await service.list(memberMembership, 'user-1', {
      q: 'design',
      page: 2,
      pageSize: 10,
    });

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          AND: expect.arrayContaining([
            {
              OR: [
                { title: { contains: 'design', mode: 'insensitive' } },
                { description: { contains: 'design', mode: 'insensitive' } },
              ],
            },
          ]),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('does not expose a task from another workspace', async () => {
    prisma.task.findFirst.mockResolvedValue(null);

    await expect(
      service.findById(memberMembership, 'task-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-x', workspaceId: 'ws-1' },
      }),
    );
  });

  it('rejects invalid status transitions', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.TODO,
      ownerId: 'user-1',
      startedAt: null,
      preOverdueStatus: null,
      dueDate: null,
    });

    await expect(
      service.update(memberMembership, 'user-1', 'task-1', {
        status: TaskStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('assigns only workspace members', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.TODO,
      ownerId: 'user-1',
      startedAt: null,
      preOverdueStatus: null,
      dueDate: null,
    });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.assign(memberMembership, 'user-1', 'task-1', {
        assigneeId: 'outsider',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reassigns by replacing the current assignee', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.TODO,
      ownerId: 'user-1',
      startedAt: null,
      preOverdueStatus: null,
      dueDate: null,
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      status: WorkspaceMemberStatus.ACTIVE,
    });
    prisma.teamMember.findFirst.mockResolvedValue({ id: 'tm-1' });
    prisma.task.update.mockResolvedValue({
      id: 'task-1',
      title: 'Ship',
      estimatedMinutes: null,
      assignees: [{ user: { id: 'user-2', name: 'Ann', email: 'a@b.com' } }],
      outgoingDependencies: [],
    });

    await service.assign(memberMembership, 'user-1', 'task-1', {
      assigneeId: 'user-2',
    });

    expect(prisma.taskAssignee.deleteMany).toHaveBeenCalledWith({
      where: { taskId: 'task-1' },
    });
    expect(prisma.taskAssignee.create).toHaveBeenCalledWith({
      data: { taskId: 'task-1', userId: 'user-2', role: 'ASSIGNEE' },
    });
  });

  it('creates tasks in the membership workspace only', async () => {
    projectsService.assertProjectInWorkspace.mockResolvedValue({
      id: 'proj-1',
      status: ProjectStatus.ACTIVE,
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      status: WorkspaceMemberStatus.ACTIVE,
    });
    prisma.task.create.mockResolvedValue({
      id: 'task-1',
    });
    prisma.task.findFirstOrThrow.mockResolvedValue({
      id: 'task-1',
      title: 'Write spec',
      workspaceId: 'ws-1',
      estimatedMinutes: null,
      assignees: [],
      outgoingDependencies: [],
    });

    await service.create(memberMembership, 'user-1', {
      title: 'Write spec',
      projectId: 'proj-1',
      assigneeId: 'user-2',
    });

    expect(projectsService.assertProjectInWorkspace).toHaveBeenCalledWith(
      'ws-1',
      'proj-1',
    );
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Write spec',
          workspaceId: 'ws-1',
          ownerId: 'user-2',
          assignedById: 'user-1',
          projectId: 'proj-1',
          status: TaskStatus.TODO,
        }),
      }),
    );
  });

  it('lets members delete only their own tasks', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.TODO,
      ownerId: 'other-user',
      assignedById: 'other-user',
      startedAt: null,
      preOverdueStatus: null,
      dueDate: null,
    });

    await expect(
      service.remove(memberMembership, 'user-1', 'task-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets admins delete any workspace task', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.TODO,
      ownerId: 'other-user',
      startedAt: null,
      preOverdueStatus: null,
      dueDate: null,
    });
    prisma.task.delete.mockResolvedValue({ id: 'task-1' });

    await service.remove(adminMembership, 'admin-1', 'task-1');

    expect(prisma.task.delete).toHaveBeenCalledWith({
      where: { id: 'task-1' },
    });
  });

  it('blocks VIEWER from creating tasks', async () => {
    const viewer: WorkspaceMembershipContext = {
      workspaceId: 'ws-1',
      memberId: 'mem-view',
      role: WorkspaceRole.VIEWER,
    };
    await expect(
      service.create(viewer, 'user-1', { title: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('rejects dependencies that are not in the workspace', async () => {
    prisma.task.create.mockResolvedValue({ id: 'task-1' });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.taskDependency.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.create(memberMembership, 'user-1', {
        title: 'Blocked work',
        dependsOnTaskIds: ['foreign-task'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws-1', id: { in: ['foreign-task'] } },
      }),
    );
  });

  it('stores workspace-scoped DEPENDS_ON edges', async () => {
    prisma.task.create.mockResolvedValue({ id: 'task-1' });
    prisma.task.findMany.mockResolvedValue([{ id: 'pred-1' }]);
    prisma.taskDependency.deleteMany.mockResolvedValue({ count: 0 });
    prisma.taskDependency.create.mockResolvedValue({ id: 'dep-1' });
    prisma.task.findFirstOrThrow.mockResolvedValue({
      id: 'task-1',
      title: 'Blocked work',
      estimatedMinutes: null,
      assignees: [],
      outgoingDependencies: [
        {
          toTask: {
            id: 'pred-1',
            title: 'Predecessor',
            status: TaskStatus.TODO,
          },
        },
      ],
    });

    const result = await service.create(memberMembership, 'user-1', {
      title: 'Blocked work',
      dependsOnTaskIds: ['pred-1', 'pred-1', 'task-1'],
    });

    expect(prisma.taskDependency.create).toHaveBeenCalledTimes(1);
    expect(prisma.taskDependency.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws-1',
        fromTaskId: 'task-1',
        toTaskId: 'pred-1',
        type: 'DEPENDS_ON',
      },
    });
    expect(result.dependsOn).toEqual([
      { id: 'pred-1', title: 'Predecessor', status: TaskStatus.TODO },
    ]);
  });

  it('marks overdue tasks with a single update', async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    await service.list(memberMembership, 'user-1', { page: 1, pageSize: 20 });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('rejects raw status changes into review or completed', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.IN_PROGRESS,
      ownerId: 'user-2',
      assignedById: 'user-1',
      startedAt: new Date(),
      preOverdueStatus: null,
      dueDate: null,
      projectId: null,
    });

    await expect(
      service.update(memberMembership, 'user-2', 'task-1', {
        status: TaskStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(memberMembership, 'user-2', 'task-1', {
        status: TaskStatus.IN_REVIEW,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(memberMembership, 'user-2', 'task-1', {
        status: TaskStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('starts work through the start action instead of a status picker', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.TODO,
      ownerId: 'user-2',
      assignedById: 'user-1',
      startedAt: null,
      preOverdueStatus: null,
      dueDate: null,
      projectId: null,
    });
    prisma.task.update.mockResolvedValue({
      id: 'task-1',
      title: 'Ship',
      status: TaskStatus.IN_PROGRESS,
      estimatedMinutes: null,
      assignees: [{ user: { id: 'user-2', name: 'Ann', email: 'a@b.com' } }],
      submissions: [],
      outgoingDependencies: [],
      incomingDependencies: [],
    });

    const result = await service.changeStatus(
      adminMembership,
      'user-1',
      'task-1',
      { status: TaskStatus.IN_PROGRESS },
    );

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TaskStatus.IN_PROGRESS }),
      }),
    );
  });

  it('rejects creating a task with a chosen status', async () => {
    await expect(
      service.create(memberMembership, 'user-1', {
        title: 'Write spec',
        status: TaskStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('allows submit without deliverable files', async () => {
    prisma.task.findFirst
      .mockResolvedValueOnce({
        id: 'task-1',
        title: 'Ship',
        status: TaskStatus.IN_PROGRESS,
        ownerId: 'user-2',
        assignedById: 'user-1',
        projectId: null,
      })
      .mockResolvedValueOnce({
        ownerId: 'user-2',
        assignees: [{ userId: 'user-2', role: 'ASSIGNEE' }],
      });
    prisma.taskSubmission.count.mockResolvedValue(0);
    prisma.taskSubmission.create.mockResolvedValue({ id: 'sub-1' });
    prisma.taskAssignee.findMany.mockResolvedValue([
      { userId: 'user-2' },
    ]);
    prisma.taskSubmission.findMany.mockResolvedValue([
      { submitterId: 'user-2', status: SubmissionStatus.SUBMITTED },
    ]);
    prisma.task.update.mockResolvedValue({
      id: 'task-1',
      title: 'Ship',
      status: TaskStatus.IN_REVIEW,
      ownerId: 'user-2',
      estimatedMinutes: null,
      assignees: [{ user: { id: 'user-2', name: 'Ann', email: 'a@b.com' } }],
      submissions: [],
      outgoingDependencies: [],
    });

    const result = await service.submit(memberMembership, 'user-2', 'task-1', {
      fileIds: [],
    });

    expect(result.status).toBe(TaskStatus.IN_REVIEW);
    expect(prisma.workspaceFile.findMany).not.toHaveBeenCalled();
  });

  it('marks the task completed when submitted work is approved', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.IN_REVIEW,
      ownerId: 'user-2',
      assignedById: 'user-1',
      projectId: null,
    });
    prisma.taskSubmission.findFirst.mockResolvedValue({
      id: 'sub-1',
      submitterId: 'user-2',
      status: SubmissionStatus.SUBMITTED,
    });
    prisma.taskAssignee.findMany.mockResolvedValue([{ userId: 'user-2' }]);
    prisma.taskSubmission.findMany.mockResolvedValue([
      { submitterId: 'user-2', status: SubmissionStatus.APPROVED },
    ]);
    prisma.task.update.mockResolvedValue({
      id: 'task-1',
      title: 'Ship',
      status: TaskStatus.COMPLETED,
      ownerId: 'user-2',
      estimatedMinutes: null,
      assignees: [
        { user: { id: 'user-2', name: 'Ann', email: 'a@b.com' } },
      ],
      submissions: [],
      outgoingDependencies: [],
    });

    const result = await service.review(adminMembership, 'admin-1', 'task-1', {
      status: SubmissionStatus.APPROVED,
    });

    expect(result.status).toBe(TaskStatus.COMPLETED);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TaskStatus.COMPLETED }),
      }),
    );
  });

  it('does not complete a task until every assignee is approved', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      status: TaskStatus.IN_REVIEW,
      ownerId: 'user-2',
      assignedById: 'user-1',
      projectId: null,
    });
    prisma.taskSubmission.findFirst.mockResolvedValue({
      id: 'sub-1',
      submitterId: 'user-2',
      status: SubmissionStatus.SUBMITTED,
    });
    prisma.taskAssignee.findMany.mockResolvedValue([
      { userId: 'user-2' },
      { userId: 'user-3' },
    ]);
    prisma.taskSubmission.findMany.mockResolvedValue([
      { submitterId: 'user-2', status: SubmissionStatus.APPROVED },
    ]);
    prisma.task.update.mockResolvedValue({
      id: 'task-1',
      title: 'Research competitor websites',
      status: TaskStatus.IN_PROGRESS,
      ownerId: 'user-2',
      estimatedMinutes: null,
      assignees: [
        { user: { id: 'user-2', name: 'kayf', email: 'k@b.com' } },
        { user: { id: 'user-3', name: 'Asho Adey', email: 'a@b.com' } },
      ],
      submissions: [],
      outgoingDependencies: [],
    });

    const result = await service.review(adminMembership, 'admin-1', 'task-1', {
      status: SubmissionStatus.APPROVED,
    });

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TaskStatus.IN_PROGRESS,
          approvedAt: null,
          approvedById: null,
        }),
      }),
    );
  });
});
