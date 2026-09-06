import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ProjectStatus,
  TaskStatus,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { deriveProjectStatus, ProjectsService } from './projects.service';

const ownerMembership: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.OWNER,
};

const memberMembership: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-2',
  role: WorkspaceRole.MEMBER,
};

const viewerMembership: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-3',
  role: WorkspaceRole.VIEWER,
};

function hubProject(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'proj-1',
    name: 'Alpha',
    description: null,
    icon: null,
    status: ProjectStatus.PLANNING,
    priority: 'MEDIUM',
    startDate: null,
    endDate: null,
    workspaceId: 'ws-1',
    ownerId: 'user-1',
    teamId: 'team-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: { id: 'user-1', name: 'Owner', email: 'o@x.com' },
    team: { id: 'team-1', name: 'General', icon: null },
    assignments: [
      {
        id: 'asg-1',
        userId: 'user-1',
        status: 'COMPLETED',
        role: 'OWNER',
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Owner', email: 'o@x.com' },
      },
    ],
    _count: { tasks: 0, assignments: 1 },
    ...overrides,
  };
}

describe('ProjectsService', () => {
  let service: ProjectsService;
  const prisma = {
    project: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    team: { findFirst: jest.fn(), create: jest.fn() },
    projectAssignment: { upsert: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    workspaceMember: { findUnique: jest.fn() },
    task: { updateMany: jest.fn(), groupBy: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma),
    );
    prisma.task.groupBy.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('lists only projects in the membership workspace', async () => {
    prisma.project.findMany.mockResolvedValue([]);

    await service.list(ownerMembership, {}, 'user-1');

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          status: { not: ProjectStatus.ARCHIVED },
        }),
      }),
    );
  });

  it('creates a project on a default workspace team', async () => {
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.workspaceMember.findUnique.mockResolvedValue({
      status: WorkspaceMemberStatus.ACTIVE,
    });
    prisma.team.create.mockResolvedValue({ id: 'team-1' });
    prisma.project.create.mockResolvedValue(hubProject());
    prisma.project.findFirst.mockResolvedValue({
      ownerId: 'user-1',
      assignments: [{ role: 'OWNER' }],
    });

    await service.create(ownerMembership, 'user-1', { name: 'Alpha' });

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Alpha',
          status: ProjectStatus.PLANNING,
          workspaceId: 'ws-1',
          ownerId: 'user-1',
          teamId: 'team-1',
        }),
      }),
    );
  });

  it('ignores a client-supplied project status on create', async () => {
    prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });
    prisma.project.create.mockResolvedValue(hubProject());
    prisma.project.findFirst.mockResolvedValue({
      ownerId: 'user-1',
      assignments: [{ role: 'OWNER' }],
    });

    await service.create(ownerMembership, 'user-1', {
      name: 'Alpha',
      status: ProjectStatus.ACTIVE,
    });

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProjectStatus.PLANNING,
        }),
      }),
    );
  });

  it('archives a project instead of deleting it', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      status: ProjectStatus.ACTIVE,
      startDate: null,
      endDate: null,
      ownerId: 'user-1',
      name: 'Alpha',
      assignments: [{ role: 'OWNER' }],
    });
    prisma.project.update.mockResolvedValue(hubProject({ status: ProjectStatus.ARCHIVED }));

    await service.archive(memberMembership, 'proj-1', 'user-1');

    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj-1' },
        data: { status: ProjectStatus.ARCHIVED },
      }),
    );
  });

  it('does not let members delete projects', async () => {
    await expect(
      service.remove(memberMembership, 'proj-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });

  it('deletes only archived projects and detaches tasks first', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      status: ProjectStatus.ARCHIVED,
      startDate: null,
      endDate: null,
    });

    await service.remove(ownerMembership, 'proj-1');

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { projectId: 'proj-1', workspaceId: 'ws-1' },
      data: { projectId: null },
    });
    expect(prisma.project.delete).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
    });
  });

  it('rejects deleting an active project', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      status: ProjectStatus.ACTIVE,
      startDate: null,
      endDate: null,
    });

    await expect(
      service.remove(ownerMembership, 'proj-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not return a project from another workspace', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      service.findById(ownerMembership, 'proj-other', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj-other', workspaceId: 'ws-1' },
      }),
    );
  });

  it('blocks viewers from creating projects', async () => {
    await expect(
      service.create(viewerMembership, 'user-3', { name: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('deriveProjectStatus', () => {
  const tomorrow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date;
  };
  const yesterday = () => {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    return date;
  };

  it('stays archived regardless of tasks', () => {
    expect(
      deriveProjectStatus({
        currentStatus: ProjectStatus.ARCHIVED,
        startDate: yesterday(),
        taskCounts: { [TaskStatus.COMPLETED]: 3 },
      }),
    ).toBe(ProjectStatus.ARCHIVED);
  });

  it('is planning when there is no start date and no tasks', () => {
    expect(
      deriveProjectStatus({
        currentStatus: ProjectStatus.ACTIVE,
        startDate: null,
        taskCounts: {},
      }),
    ).toBe(ProjectStatus.PLANNING);
  });

  it('is planning when the start date is still in the future', () => {
    expect(
      deriveProjectStatus({
        currentStatus: ProjectStatus.ACTIVE,
        startDate: tomorrow(),
        taskCounts: { [TaskStatus.TODO]: 2 },
      }),
    ).toBe(ProjectStatus.PLANNING);
  });

  it('is active after the start date arrives', () => {
    expect(
      deriveProjectStatus({
        currentStatus: ProjectStatus.PLANNING,
        startDate: yesterday(),
        taskCounts: {},
      }),
    ).toBe(ProjectStatus.ACTIVE);
  });

  it('is active when work is in progress even before the start date', () => {
    expect(
      deriveProjectStatus({
        currentStatus: ProjectStatus.PLANNING,
        startDate: tomorrow(),
        taskCounts: { [TaskStatus.IN_PROGRESS]: 1 },
      }),
    ).toBe(ProjectStatus.ACTIVE);
  });

  it('is completed when every task is done', () => {
    expect(
      deriveProjectStatus({
        currentStatus: ProjectStatus.ACTIVE,
        startDate: yesterday(),
        taskCounts: { [TaskStatus.COMPLETED]: 4 },
      }),
    ).toBe(ProjectStatus.COMPLETED);
  });

  it('stays on hold until resumed', () => {
    expect(
      deriveProjectStatus({
        currentStatus: ProjectStatus.ON_HOLD,
        startDate: yesterday(),
        taskCounts: { [TaskStatus.COMPLETED]: 2 },
      }),
    ).toBe(ProjectStatus.ON_HOLD);
  });
});
