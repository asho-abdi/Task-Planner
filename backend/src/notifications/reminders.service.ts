import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MeetingStatus,
  NotificationType,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { expandMeetingOccurrences } from '../meetings/meeting-recurrence';

export const DEFAULT_REMIND_MINUTES = [15];

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const connection = {
      host: this.config.get<string>('redis.host') ?? 'localhost',
      port: this.config.get<number>('redis.port') ?? 6379,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
    };

    try {
      this.queue = new Queue('reminders', { connection });
      this.worker = new Worker(
        'reminders',
        async (job) => {
          if (job.name === 'meeting-reminder') {
            const data = job.data as {
              meetingId: string;
              minutes?: number;
              startAt?: string;
            };
            await this.deliverMeetingReminder(
              data.meetingId,
              data.minutes,
              data.startAt,
            );
          }
        },
        { connection },
      );
      this.worker.on('error', () => undefined);
      this.queue.on('error', () => undefined);
    } catch (error) {
      this.logger.warn(
        `Reminder queue unavailable: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      this.queue = null;
      this.worker = null;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async scheduleMeetingReminder(
    meetingId: string,
    startAt: Date,
    minutes: number[] = DEFAULT_REMIND_MINUTES,
  ) {
    const leads = minutes.length ? minutes : DEFAULT_REMIND_MINUTES;
    for (const lead of leads) {
      const runAt = startAt.getTime() - lead * 60 * 1000;
      const delay = runAt - Date.now();
      if (delay <= 0 || !this.queue) {
        continue;
      }
      try {
        await this.queue.add(
          'meeting-reminder',
          {
            meetingId,
            minutes: lead,
            startAt: startAt.toISOString(),
          },
          {
            jobId: `meeting-reminder:${meetingId}:${lead}`,
            delay,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      } catch {
        this.logger.warn(`Could not enqueue reminder for meeting ${meetingId}`);
      }
    }
  }

  async cancelMeetingReminder(meetingId: string) {
    if (!this.queue) {
      return;
    }
    try {
      const job = await this.queue.getJob(`meeting-reminder:${meetingId}`);
      await job?.remove();
      for (const lead of [15, 30, 60, 1440]) {
        const extra = await this.queue.getJob(
          `meeting-reminder:${meetingId}:${lead}`,
        );
        await extra?.remove();
      }
    } catch {
      this.logger.warn(`Could not cancel reminder for meeting ${meetingId}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepDueMeetingReminders() {
    const now = Date.now();
    const horizon = new Date(now + 24 * 60 * 60 * 1000);
    const meetings = await this.prisma.meeting.findMany({
      where: {
        status: { in: [MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS] },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        recurrence: true,
        recurrenceUntil: true,
        recurrenceWeekdays: true,
        remindMinutes: true,
        status: true,
      },
    });
    for (const meeting of meetings) {
      const leads = meeting.remindMinutes.length
        ? meeting.remindMinutes
        : DEFAULT_REMIND_MINUTES;
      const maxLead = Math.max(...leads) * 60 * 1000;
      const from = new Date(now);
      const to = new Date(Math.max(now + maxLead, horizon.getTime()));
      const starts = expandMeetingOccurrences(meeting, from, to);
      for (const startAt of starts) {
        for (const lead of leads) {
          const fireAt = startAt.getTime() - lead * 60 * 1000;
          if (now >= fireAt && now < fireAt + 60 * 1000) {
            await this.deliverMeetingReminder(
              meeting.id,
              lead,
              startAt.toISOString(),
            );
          }
        }
      }
    }
  }

  async deliverMeetingReminder(
    meetingId: string,
    minutes = 15,
    occurrenceStart?: string,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        title: true,
        startAt: true,
        status: true,
        workspaceId: true,
        organizerId: true,
        participants: { select: { userId: true } },
      },
    });
    if (
      !meeting ||
      meeting.status === MeetingStatus.CANCELLED ||
      meeting.status === MeetingStatus.COMPLETED
    ) {
      return;
    }

    const recipientIds = [
      ...new Set([
        meeting.organizerId,
        ...meeting.participants.map((item) => item.userId),
      ]),
    ];
    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: meeting.workspaceId,
        userId: { in: recipientIds },
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { userId: true },
    });
    const prefs = await this.prisma.notificationPreference.findMany({
      where: {
        workspaceId: meeting.workspaceId,
        userId: { in: members.map((member) => member.userId) },
      },
      select: { userId: true, meetingReminder: true, inApp: true },
    });
    const prefsByUser = new Map(prefs.map((row) => [row.userId, row]));
    const startLabel = occurrenceStart ?? meeting.startAt.toISOString();
    const memberIds = members
      .filter((member) => {
        const pref = prefsByUser.get(member.userId);
        return pref?.meetingReminder !== false && pref?.inApp !== false;
      })
      .map((member) => member.userId);
    const entityType = `reminder:${minutes}:${startLabel}`;
    const existing = memberIds.length
      ? await this.prisma.notification.findMany({
          where: {
            meetingId: meeting.id,
            type: NotificationType.MEETING_REMINDER,
            entityType,
            userId: { in: memberIds },
          },
          select: { userId: true },
        })
      : [];
    const alreadyNotified = new Set(existing.map((row) => row.userId));

    await Promise.all(
      memberIds
        .filter((userId) => !alreadyNotified.has(userId))
        .map((userId) =>
          this.prisma.notification.create({
            data: {
              userId,
              workspaceId: meeting.workspaceId,
              meetingId: meeting.id,
              type: NotificationType.MEETING_REMINDER,
              entityId: meeting.id,
              entityType,
              title: 'Meeting reminder',
              message: `${meeting.title} starts at ${startLabel}`,
            },
          }),
        ),
    );
  }
}
