import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AutomationActionType,
  AutomationTrigger,
  NotificationType,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanAdminister, assertCanMutate } from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateAutomationDto,
  UpdateAutomationDto,
} from './dto/automation.dto';

export type AutomationDispatch = {
  workspaceId: string;
  trigger: AutomationTrigger;
  actorUserId?: string;
  ownerId?: string | null;
  assigneeIds?: string[];
  title: string;
  entityId: string;
  entityType: string;
};

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(membership: WorkspaceMembershipContext) {
    return this.prisma.automation.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateAutomationDto,
  ) {
    assertCanAdminister(membership);
    return this.prisma.automation.create({
      data: {
        workspaceId: membership.workspaceId,
        name: dto.name.trim(),
        trigger: dto.trigger,
        action: dto.action,
        createdById: userId,
      },
    });
  }

  async update(
    membership: WorkspaceMembershipContext,
    automationId: string,
    dto: UpdateAutomationDto,
  ) {
    assertCanAdminister(membership);
    const automation = await this.require(membership.workspaceId, automationId);
    return this.prisma.automation.update({
      where: { id: automation.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
    });
  }

  async remove(membership: WorkspaceMembershipContext, automationId: string) {
    assertCanMutate(membership);
    assertCanAdminister(membership);
    const automation = await this.require(membership.workspaceId, automationId);
    await this.prisma.automation.delete({ where: { id: automation.id } });
  }

  async dispatch(event: AutomationDispatch): Promise<void> {
    const automations = await this.prisma.automation.findMany({
      where: {
        workspaceId: event.workspaceId,
        trigger: event.trigger,
        enabled: true,
      },
    });
    if (automations.length === 0) {
      return;
    }

    for (const automation of automations) {
      const userIds = await this.resolveRecipients(event, automation.action);
      await this.notifications.notify({
        workspaceId: event.workspaceId,
        userIds,
        type: NotificationType.AUTOMATION,
        title: automation.name,
        message: event.title,
        entityId: event.entityId,
        entityType: event.entityType,
      });
    }
  }

  private async resolveRecipients(
    event: AutomationDispatch,
    action: AutomationActionType,
  ): Promise<string[]> {
    if (action === AutomationActionType.NOTIFY_ASSIGNEE) {
      return event.assigneeIds ?? [];
    }
    if (action === AutomationActionType.NOTIFY_OWNER) {
      return event.ownerId ? [event.ownerId] : [];
    }

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId: event.workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  private async require(workspaceId: string, automationId: string) {
    const automation = await this.prisma.automation.findFirst({
      where: { id: automationId, workspaceId },
    });
    if (!automation) {
      throw new NotFoundException('Automation not found');
    }
    return automation;
  }
}
