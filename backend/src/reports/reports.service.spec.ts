import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  DependencyType,
  Priority,
  TaskStatus,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { ReportsService } from './reports.service';

const member: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.MEMBER,
};

const now = new Date('2026-08-29T12:00:00.000Z');

describe('ReportsService', () => {
  let service: ReportsService;
  const prisma = {
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    meeting: { findMany: jest.fn(), count: jest.fn() },
    taskDependency: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const redis = { get: jest.fn(), set: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(undefined);
    config.get.mockReturnValue(8);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    prisma.meeting.findMany.mockResolvedValue([]);
    prisma.meeting.count.mockResolvedValue(0);
    prisma.taskDependency.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.task.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.activityEvent = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.milestone = { findMany: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  it('scopes My Day tasks and meetings to the member and workspace', async () => {
    await service.getMyDay(member, 'user-1', { date: '2026-08-29' }, now);

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          OR: [
            { ownerId: 'user-1' },
            { assignees: { some: { userId: 'user-1' } } },
          ],
        }),
        take: 20,
      }),
    );
    expect(prisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          OR: [
            { organizerId: 'user-1' },
            { participants: { some: { userId: 'user-1' } } },
          ],
        }),
      }),
    );
  });

  it('includes tasks completed today without mixing them into open work', async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    const result = await service.getMyDay(
      member,
      'user-1',
      { date: '2026-08-29' },
      now,
    );

    expect(result.completedTasks).toEqual({ items: [], total: 0 });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          status: TaskStatus.COMPLETED,
        }),
      }),
    );
  });

  it('returns cached My Day without querying the database', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ date: '2026-08-29', cached: true }),
    );

    const result = await service.getMyDay(
      member,
      'user-1',
      { date: '2026-08-29' },
      now,
    );

    expect(result).toEqual({ date: '2026-08-29', cached: true });
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('aggregates workload with the membership workspace and daily capacity', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        userId: 'user-1',
        name: 'Ann',
        email: 'ann@example.com',
        todayMinutes: 540,
        openMinutes: 600,
        unestimatedCount: 1,
        openTaskCount: 3,
        total: 1,
      },
    ]);

    const result = await service.getWorkload(
      member,
      { date: '2026-08-29', page: 1, pageSize: 20 },
      now,
    );

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.hoursPerDay).toBe(8);
    expect(result.users[0].todayHours).toBe(9);
    expect(result.users[0].overloaded).toBe(true);
    expect(result.overloadedCount).toBe(1);
    const sqlParts = prisma.$queryRaw.mock.calls[0]?.[0] as {
      strings?: string[];
    };
    expect(sqlParts.strings?.join(' ')).toContain('workspaceId');
    expect(sqlParts.strings?.join(' ')).toContain('WorkspaceMemberStatus');
  });

  it('scores risk from overdue, deadline, dependency, workload, and priority', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        userId: 'user-1',
        name: 'Ann',
        email: 'ann@example.com',
        todayMinutes: 600,
        openMinutes: 600,
        unestimatedCount: 0,
        openTaskCount: 1,
        total: 1,
      },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Blocked overdue',
        status: TaskStatus.OVERDUE,
        priority: Priority.URGENT,
        dueDate: new Date('2026-08-28T12:00:00.000Z'),
        projectId: 'proj-1',
        assignees: [{ userId: 'user-1' }],
      },
      {
        id: 'pred-1',
        title: 'Predecessor',
        status: TaskStatus.TODO,
        priority: Priority.LOW,
        dueDate: null,
        projectId: null,
        assignees: [],
      },
    ]);
    prisma.taskDependency.findMany.mockResolvedValue([
      {
        fromTaskId: 'task-1',
        toTaskId: 'pred-1',
        type: DependencyType.DEPENDS_ON,
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', name: 'Ann' }]);
    prisma.project.findMany.mockResolvedValue([
      { id: 'proj-1', name: 'Alpha' },
    ]);

    const result = await service.getRisk(
      member,
      { page: 1, pageSize: 20 },
      now,
    );

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'ws-1' }),
      }),
    );
    const top = result.items[0];
    expect(top.id).toBe('task-1');
    expect(top.blocked).toBe(true);
    expect(top.score).toBe(40 + 18 + 12 + 24);
    expect(top.level).toBe('CRITICAL');
    expect(top.project).toEqual({ id: 'proj-1', name: 'Alpha' });
    expect(result.summary.overdueCount).toBe(1);
  });

  it('aggregates reports by workspace without returning raw task lists', async () => {
    prisma.task.groupBy
      .mockResolvedValueOnce([
        { status: TaskStatus.COMPLETED, _count: { _all: 4 } },
        { status: TaskStatus.OVERDUE, _count: { _all: 1 } },
        { status: TaskStatus.TODO, _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([
        {
          projectId: 'proj-1',
          status: TaskStatus.COMPLETED,
          _count: { _all: 4 },
        },
        { projectId: 'proj-1', status: TaskStatus.TODO, _count: { _all: 1 } },
      ]);
    prisma.task.count.mockResolvedValue(1);
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          userId: 'user-1',
          name: 'Ann',
          email: 'a@b.com',
          todayMinutes: 60,
          openMinutes: 60,
          unestimatedCount: 0,
          openTaskCount: 1,
          total: 1,
        },
      ]);
    prisma.project.findMany.mockResolvedValue([
      { id: 'proj-1', name: 'Alpha' },
    ]);

    const result = await service.getReports(
      member,
      { from: '2026-08-16', to: '2026-08-29' },
      now,
    );

    expect(prisma.task.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'ws-1' }),
      }),
    );
    expect(result.completion.completed).toBe(4);
    expect(result.overdue.count).toBe(1);
    expect(result.trends).toHaveLength(14);
    expect(result.projectPerformance.items[0].name).toBe('Alpha');
    expect(result.projectPerformance.items[0].completionRate).toBe(0.8);
  });

  it('scopes dashboard totals and my-day work to the member workspace', async () => {
    prisma.task.count.mockResolvedValue(3);
    prisma.meeting.count.mockResolvedValue(2);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Finish API',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        dueDate: new Date('2026-08-29T15:00:00.000Z'),
        startDate: null,
        estimatedMinutes: 60,
        project: { id: 'proj-1', name: 'Website' },
        owner: { id: 'user-1', name: 'Ann' },
        assignees: [{ user: { id: 'user-1', name: 'Ann' } }],
      },
    ]);
    prisma.meeting.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.task.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([
      {
        userId: 'user-1',
        name: 'Ann',
        email: 'ann@example.com',
        todayMinutes: 480,
        openMinutes: 480,
        unestimatedCount: 0,
        openTaskCount: 3,
        weekDeadlineCount: 1,
        total: 1,
      },
    ]);

    const result = await service.getDashboard(member, 'user-1', now);

    expect(prisma.task.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          OR: [
            { ownerId: 'user-1' },
            { assignees: { some: { userId: 'user-1' } } },
          ],
        }),
      }),
    );
    expect(result.totals.myTasks).toBe(3);
    expect(result.totals.upcomingMeetings).toBe(2);
    expect(result.myDay.items[0].title).toBe('Finish API');
    expect(result.myDay.items[0].assignee).toEqual({
      id: 'user-1',
      name: 'Ann',
    });
    expect(result.teamWorkload[0].overloaded).toBe(false);
    expect(prisma.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws-1' },
      }),
    );
    expect(prisma.milestone.findMany).toHaveBeenCalled();
  });
});
