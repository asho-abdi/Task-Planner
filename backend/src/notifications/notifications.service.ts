import { Injectable, Optional } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationPrefsDto } from './dto/notification.dto';
import { RealtimeService } from '../realtime/realtime.service';

export type NotifyInput = {
  workspaceId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  meetingId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async list(userId: string, workspaceId: string) {
    const [items, unreadCount, prefs] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, workspaceId, isRead: false },
      }),
      this.getPrefs(userId, workspaceId),
    ]);
    return { items, unreadCount, prefs };
  }

  async markRead(userId: string, workspaceId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, workspaceId },
      data: { isRead: true },
    });
    return this.list(userId, workspaceId);
  }

  async markAllRead(userId: string, workspaceId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, workspaceId, isRead: false },
      data: { isRead: true },
    });
    return this.list(userId, workspaceId);
  }

  async getPrefs(userId: string, workspaceId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return {
      inApp: existing?.inApp ?? true,
      email: existing?.email ?? false,
    };
  }

  async updatePrefs(
    userId: string,
    workspaceId: string,
    dto: NotificationPrefsDto,
  ) {
    const current = await this.getPrefs(userId, workspaceId);
    const updated = await this.prisma.notificationPreference.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: {
        workspaceId,
        userId,
        inApp: dto.inApp ?? current.inApp,
        email: dto.email ?? current.email,
      },
      update: {
        ...(dto.inApp !== undefined ? { inApp: dto.inApp } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
      },
    });
    return { inApp: updated.inApp, email: updated.email };
  }

  async notify(input: NotifyInput): Promise<void> {
    const uniqueIds = [...new Set(input.userIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return;
    }

    const [prefs, users] = await Promise.all([
      this.prisma.notificationPreference.findMany({
        where: {
          workspaceId: input.workspaceId,
          userId: { in: uniqueIds },
        },
      }),
      this.prisma.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, email: true },
      }),
    ]);
    const prefByUser = new Map(prefs.map((item) => [item.userId, item]));
    const emailByUser = new Map(users.map((item) => [item.id, item.email]));

    const inAppRecipients = uniqueIds.filter(
      (id) => prefByUser.get(id)?.inApp !== false,
    );
    if (inAppRecipients.length) {
      await this.prisma.notification.createMany({
        data: inAppRecipients.map((userId) => ({
          userId,
          workspaceId: input.workspaceId,
          type: input.type,
          title: input.title,
          message: input.message,
          entityId: input.entityId,
          entityType: input.entityType,
          meetingId: input.meetingId,
        })),
      });
      for (const userId of inAppRecipients) {
        this.realtime?.emitToUser(userId, 'notification:new', {
          title: input.title,
          message: input.message,
          type: input.type,
          entityId: input.entityId,
          entityType: input.entityType,
          workspaceId: input.workspaceId,
        });
      }
    }

    const emailRecipients = uniqueIds.filter(
      (id) => prefByUser.get(id)?.email === true,
    );
    await Promise.all(
      emailRecipients.map((userId) => {
        const to = emailByUser.get(userId);
        if (!to) {
          return Promise.resolve();
        }
        return this.mail.send({
          to,
          subject: input.title,
          text: input.message,
        });
      }),
    );
  }
}
