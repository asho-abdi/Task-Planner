import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MeetingRecurrence, MeetingStatus, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { RemindersService } from '../notifications/reminders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from '../automations/automations.service';
import { TasksService } from '../tasks/tasks.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { expandMeetingOccurrences } from './meeting-recurrence';
import { MeetingsService } from './meetings.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));
jest.mock('bullmq', () => ({
  Queue: class Queue {},
  Worker: class Worker {},
}));

const member: WorkspaceMembershipContext = {
  workspaceId: 'ws-1',
  memberId: 'mem-1',
  role: WorkspaceRole.MEMBER,
};

function meetingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mtg-1',
    title: 'Standup',
    description: null,
    startAt: new Date('2026-09-01T10:00:00.000Z'),
    endAt: new Date('2026-09-01T10:30:00.000Z'),
    location: null,
    meetingLink: null,
    meetingProvider: null,
    room: null,
    address: null,
    mapUrl: null,
    mode: 'OFFLINE',
    organizerId: 'user-1',
    projectId: null,
    teamId: null,
    status: MeetingStatus.SCHEDULED,
    notes: null,
    discussion: null,
    decisions: null,
    remindMinutes: [15],
    recurrence: MeetingRecurrence.NONE,
    recurrenceUntil: null,
    recurrenceWeekdays: [],
    workspaceId: 'ws-1',
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    updatedAt: new Date('2026-09-01T09:00:00.000Z'),
    organizer: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
    project: null,
    team: null,
    participants: [],
    agendaItems: [],
    actionItems: [],
    tasks: [],
    ...overrides,
  };
}

describe('MeetingsService', () => {
  let service: MeetingsService;
  const prisma = {
    meeting: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    meetingParticipant: { deleteMany: jest.fn(), createMany: jest.fn(), create: jest.fn() },
    meetingAgendaItem: { deleteMany: jest.fn(), createMany: jest.fn(), create: jest.fn() },
    meetingActionItem: { create: jest.fn(), update: jest.fn() },
    workspaceMember: { findMany: jest.fn(), findUnique: jest.fn() },
    team: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const projectsService = { assertProjectInWorkspace: jest.fn() };
  const reminders = {
    scheduleMeetingReminder: jest.fn(),
    cancelMeetingReminder: jest.fn(),
  };
  const notifications = { notify: jest.fn() };
  const automations = { dispatch: jest.fn() };
  const tasks = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projectsService },
        { provide: RemindersService, useValue: reminders },
        { provide: NotificationsService, useValue: notifications },
        { provide: AutomationsService, useValue: automations },
        { provide: TasksService, useValue: tasks },
      ],
    }).compile();
    service = module.get(MeetingsService);
  });

  it('lists only meetings in the membership workspace', async () => {
    prisma.meeting.findMany.mockResolvedValue([]);
    await service.list(member, {});
    expect(prisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          status: { not: MeetingStatus.CANCELLED },
        }),
      }),
    );
  });

  it('rejects meetings that end before they start', async () => {
    await expect(
      service.create(member, 'user-1', {
        title: 'Standup',
        startAt: '2026-09-01T10:00:00.000Z',
        endAt: '2026-09-01T09:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects participants who are not workspace members', async () => {
    prisma.workspaceMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    await expect(
      service.create(member, 'user-1', {
        title: 'Standup',
        startAt: '2026-09-01T10:00:00.000Z',
        endAt: '2026-09-01T10:30:00.000Z',
        participantIds: ['outsider'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('schedules a reminder when a meeting is created', async () => {
    prisma.workspaceMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    prisma.meeting.create.mockResolvedValue(meetingRecord());
    await service.create(member, 'user-1', {
      title: 'Standup',
      startAt: '2026-09-01T10:00:00.000Z',
      endAt: '2026-09-01T10:30:00.000Z',
    });
    expect(reminders.scheduleMeetingReminder).toHaveBeenCalledWith(
      'mtg-1',
      expect.any(Date),
      [15],
    );
  });

  it("does not let a member cancel someone else's meeting", async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      meetingRecord({ organizerId: 'other' }),
    );
    await expect(
      service.cancel(member, 'user-1', 'mtg-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a participant update notes without being the organizer', async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      meetingRecord({
        organizerId: 'other',
        participants: [{ userId: 'user-1' }],
      }),
    );
    prisma.meeting.update.mockResolvedValue(
      meetingRecord({
        organizerId: 'other',
        discussion: 'Talked through the launch',
        participants: [{ userId: 'user-1' }],
      }),
    );
    await expect(
      service.update(member, 'user-1', 'mtg-1', {
        discussion: 'Talked through the launch',
      }),
    ).resolves.toMatchObject({ discussion: 'Talked through the launch' });
  });

  it('does not let a participant change meeting details', async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      meetingRecord({
        organizerId: 'other',
        participants: [{ userId: 'user-1' }],
      }),
    );
    await expect(
      service.update(member, 'user-1', 'mtg-1', { title: 'Hijacked' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not let a non-participant member update notes', async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      meetingRecord({ organizerId: 'other', participants: [] }),
    );
    await expect(
      service.update(member, 'user-1', 'mtg-1', { notes: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not expose a meeting from another workspace', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);
    await expect(service.findById(member, 'mtg-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.meeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mtg-x', workspaceId: 'ws-1' },
      }),
    );
  });
});

describe('expandMeetingOccurrences', () => {
  it('keeps a single row for weekly recurrence instead of duplicating meetings', () => {
    const starts = expandMeetingOccurrences(
      {
        startAt: new Date('2026-09-07T11:00:00.000Z'),
        endAt: new Date('2026-09-07T12:00:00.000Z'),
        recurrence: MeetingRecurrence.WEEKLY,
        recurrenceUntil: new Date('2026-09-28T12:00:00.000Z'),
        recurrenceWeekdays: [],
      },
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-30T00:00:00.000Z'),
    );
    expect(starts.map((item) => item.toISOString())).toEqual([
      '2026-09-07T11:00:00.000Z',
      '2026-09-14T11:00:00.000Z',
      '2026-09-21T11:00:00.000Z',
      '2026-09-28T11:00:00.000Z',
    ]);
  });
});
