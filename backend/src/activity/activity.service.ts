import { Injectable, Optional } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async log(input: {
    workspaceId: string;
    actorId?: string | null;
    type: ActivityType;
    title: string;
    entityType?: string;
    entityId?: string;
  }) {
    const event = await this.prisma.activityEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: {
        id: true,
        type: true,
        title: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    this.realtime?.emitToWorkspace(input.workspaceId, 'activity:new', event);
    return event;
  }

  list(workspaceId: string) {
    return this.prisma.activityEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        type: true,
        title: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
