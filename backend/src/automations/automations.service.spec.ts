import { Test } from '@nestjs/testing';
import {
  AutomationActionType,
  AutomationTrigger,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from './automations.service';

describe('AutomationsService', () => {
  let service: AutomationsService;
  const prisma = {
    automation: { findMany: jest.fn() },
  };
  const notifications = { notify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AutomationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get(AutomationsService);
  });

  it('notifies assignees when a matching automation is enabled', async () => {
    prisma.automation.findMany.mockResolvedValue([
      {
        id: 'auto-1',
        name: 'Done ping',
        action: AutomationActionType.NOTIFY_ASSIGNEE,
      },
    ]);

    await service.dispatch({
      workspaceId: 'ws-1',
      trigger: AutomationTrigger.TASK_COMPLETED,
      assigneeIds: ['u-2'],
      ownerId: 'u-1',
      title: 'Ship it',
      entityId: 'task-1',
      entityType: 'task',
    });

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        userIds: ['u-2'],
        type: NotificationType.AUTOMATION,
        title: 'Done ping',
      }),
    );
  });
});
