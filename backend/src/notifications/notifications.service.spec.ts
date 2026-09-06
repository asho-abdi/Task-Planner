import { Test } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const prisma = {
    notification: { findMany: jest.fn(), count: jest.fn(), createMany: jest.fn() },
    notificationPreference: { findMany: jest.fn(), findUnique: jest.fn() },
    user: { findMany: jest.fn() },
  };
  const mail = { send: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u-2', email: 'a@b.com' }]);
    prisma.notification.createMany.mockResolvedValue({ count: 1 });
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('writes in-app notifications for workspace members', async () => {
    await service.notify({
      workspaceId: 'ws-1',
      userIds: ['u-2'],
      type: NotificationType.TASK_ASSIGNED,
      title: 'Assigned',
      message: 'Do the thing',
      entityId: 'task-1',
      entityType: 'task',
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'u-2',
          workspaceId: 'ws-1',
          type: NotificationType.TASK_ASSIGNED,
        }),
      ],
    });
    expect(mail.send).not.toHaveBeenCalled();
  });
});
