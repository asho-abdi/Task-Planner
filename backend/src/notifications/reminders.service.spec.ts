import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  MeetingStatus,
  NotificationType,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from './reminders.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));
jest.mock('bullmq', () => ({
  Queue: class Queue {},
  Worker: class Worker {},
}));

describe('RemindersService', () => {
  let service: RemindersService;
  const prisma = {
    meeting: { findUnique: jest.fn(), findMany: jest.fn() },
    workspaceMember: { findMany: jest.fn() },
    notification: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    notificationPreference: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'redis.port' ? 6379 : 'localhost'),
          },
        },
      ],
    }).compile();
    service = module.get(RemindersService);
  });

  it('does not remind cancelled meetings', async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: 'mtg-1',
      status: MeetingStatus.CANCELLED,
      title: 'Standup',
      participants: [],
    });
    await service.deliverMeetingReminder('mtg-1');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('creates a reminder notification once per recipient', async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: 'mtg-1',
      title: 'Standup',
      startAt: new Date('2026-09-01T10:00:00.000Z'),
      status: MeetingStatus.SCHEDULED,
      workspaceId: 'ws-1',
      organizerId: 'user-1',
      participants: [{ userId: 'user-2' }],
    });
    prisma.workspaceMember.findMany.mockResolvedValue([
      { userId: 'user-1', status: WorkspaceMemberStatus.ACTIVE },
      { userId: 'user-2', status: WorkspaceMemberStatus.ACTIVE },
    ]);
    prisma.notification.findMany.mockResolvedValue([{ userId: 'user-2' }]);
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.notification.create.mockResolvedValue({ id: 'n-1' });

    await service.deliverMeetingReminder('mtg-1');

    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          status: WorkspaceMemberStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.notification.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.MEETING_REMINDER,
          meetingId: 'mtg-1',
          userId: 'user-1',
          entityType: expect.stringContaining('reminder:15:'),
        }),
      }),
    );
  });
});
