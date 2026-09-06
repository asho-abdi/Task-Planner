import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ActivityType,
  MeetingMode,
  MeetingParticipantKind,
  MeetingRecurrence,
  MeetingResponse,
  MeetingStatus,
  NotificationType,
  Prisma,
  ProjectStatus,
  TaskParticipantRole,
  TaskStatus,
  WorkspaceMemberStatus,
  AutomationTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanMutate, canAdminister } from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import { ProjectsService } from '../projects/projects.service';
import { RemindersService } from '../notifications/reminders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationsService } from '../automations/automations.service';
import { TasksService } from '../tasks/tasks.service';
import { ActivityService } from '../activity/activity.service';
import {
  CalendarQueryDto,
  ConvertActionItemDto,
  CreateActionItemDto,
  CreateMeetingDto,
  ListMeetingsQueryDto,
  MeetingParticipantInputDto,
  UpdateActionItemDto,
  UpdateMeetingDto,
} from './dto/meeting.dto';
import { expandMeetingOccurrences } from './meeting-recurrence';

const personSelect = { id: true, name: true, email: true };
const ALLOWED_REMIND_MINUTES = [15, 30, 60, 1440];

const meetingSelect = {
  id: true,
  title: true,
  description: true,
  startAt: true,
  endAt: true,
  location: true,
  meetingLink: true,
  meetingProvider: true,
  room: true,
  address: true,
  mapUrl: true,
  mode: true,
  organizerId: true,
  projectId: true,
  teamId: true,
  status: true,
  notes: true,
  discussion: true,
  decisions: true,
  remindMinutes: true,
  recurrence: true,
  recurrenceUntil: true,
  recurrenceWeekdays: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  organizer: { select: personSelect },
  project: { select: { id: true, name: true, status: true } },
  team: { select: { id: true, name: true, icon: true } },
  participants: {
    select: {
      id: true,
      userId: true,
      kind: true,
      response: true,
      respondedAt: true,
      user: { select: personSelect },
    },
    orderBy: { createdAt: 'asc' },
  },
  agendaItems: {
    select: { id: true, title: true, position: true },
    orderBy: { position: 'asc' },
  },
  actionItems: {
    select: {
      id: true,
      title: true,
      description: true,
      assigneeId: true,
      dueDate: true,
      done: true,
      taskId: true,
      position: true,
      assignee: { select: personSelect },
      task: { select: { id: true, title: true, status: true } },
    },
    orderBy: { position: 'asc' },
  },
  tasks: {
    select: { id: true, title: true, status: true, dueDate: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  },
} satisfies Prisma.MeetingSelect;

type MeetingRecord = Prisma.MeetingGetPayload<{ select: typeof meetingSelect }>;

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly reminders: RemindersService,
    private readonly notifications: NotificationsService,
    private readonly automations: AutomationsService,
    private readonly tasks: TasksService,
    @Optional() private readonly activity?: ActivityService,
  ) {}

  async list(
    membership: WorkspaceMembershipContext,
    query: ListMeetingsQueryDto,
  ) {
    const where: Prisma.MeetingWhereInput = {
      workspaceId: membership.workspaceId,
    };
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeCancelled) {
      where.status = { not: MeetingStatus.CANCELLED };
    }
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.teamId) {
      where.teamId = query.teamId;
    }
    const meetings = await this.prisma.meeting.findMany({
      where,
      select: meetingSelect,
      orderBy: { startAt: 'asc' },
    });
    const window = rangeWindow(query);
    return meetings.flatMap((meeting) => {
      const mapped = this.toMeeting(meeting);
      if (!window) {
        return [mapped];
      }
      return expandMeetingOccurrences(meeting, window.from, window.to).map(
        (startAt) => occurrenceView(mapped, startAt, meeting.endAt),
      );
    });
  }

  async findById(membership: WorkspaceMembershipContext, meetingId: string) {
    return this.toMeeting(
      await this.requireMeeting(membership.workspaceId, meetingId),
    );
  }

  async calendar(
    membership: WorkspaceMembershipContext,
    query: CalendarQueryDto,
  ) {
    const from = query.from ? new Date(query.from) : startOfMonth(new Date());
    const to = query.to ? new Date(query.to) : endOfMonth(from);
    const types = new Set(
      (query.types ?? 'meeting,task,deadline,milestone')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );
    const events: CalendarEvent[] = [];

    if (types.has('meeting')) {
      const meetings = await this.prisma.meeting.findMany({
        where: {
          workspaceId: membership.workspaceId,
          status: { not: MeetingStatus.CANCELLED },
          ...(query.projectId ? { projectId: query.projectId } : {}),
          ...(query.teamId ? { teamId: query.teamId } : {}),
          ...(query.userId
            ? {
                OR: [
                  { organizerId: query.userId },
                  { participants: { some: { userId: query.userId } } },
                ],
              }
            : {}),
        },
        select: meetingSelect,
      });
      for (const meeting of meetings) {
        const mapped = this.toMeeting(meeting);
        for (const startAt of expandMeetingOccurrences(meeting, from, to)) {
          const view = occurrenceView(mapped, startAt, meeting.endAt);
          events.push({
            id: `${meeting.id}:${startAt.toISOString()}`,
            type: 'meeting',
            title: meeting.title,
            startAt: view.startAt,
            endAt: view.endAt,
            href: `/app/meetings/${meeting.id}`,
            status: view.status,
            projectId: meeting.projectId,
            teamId: meeting.teamId,
            userIds: meeting.participants.map((item) => item.userId),
          });
        }
      }
    }

    if (types.has('task') || types.has('deadline')) {
      const tasks = await this.prisma.task.findMany({
        where: {
          workspaceId: membership.workspaceId,
          status: { not: TaskStatus.ARCHIVED },
          ...(query.projectId ? { projectId: query.projectId } : {}),
          ...(query.userId
            ? {
                OR: [
                  { ownerId: query.userId },
                  { assignees: { some: { userId: query.userId } } },
                ],
              }
            : {}),
          ...(query.teamId
            ? { project: { teamId: query.teamId } }
            : {}),
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          startDate: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          projectId: true,
          ownerId: true,
          assignees: { select: { userId: true } },
          project: { select: { teamId: true } },
        },
      });
      for (const task of tasks) {
        const userIds = [
          ...new Set(
            [task.ownerId, ...task.assignees.map((item) => item.userId)].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        ];
        if (types.has('deadline') && task.dueDate && inRange(task.dueDate, from, to)) {
          events.push({
            id: `deadline:${task.id}`,
            type: 'deadline',
            title: task.title,
            startAt: task.dueDate.toISOString(),
            href: `/app/tasks/${task.id}`,
            status: task.status,
            projectId: task.projectId,
            teamId: task.project?.teamId ?? null,
            userIds,
          });
        }
        const taskStart = task.scheduledStart ?? task.startDate;
        if (types.has('task') && taskStart && inRange(taskStart, from, to)) {
          events.push({
            id: `task:${task.id}`,
            type: 'task',
            title: task.title,
            startAt: taskStart.toISOString(),
            endAt: task.scheduledEnd?.toISOString() ?? null,
            href: `/app/tasks/${task.id}`,
            status: task.status,
            projectId: task.projectId,
            teamId: task.project?.teamId ?? null,
            userIds,
          });
        }
      }
    }

    if (types.has('milestone')) {
      const milestones = await this.prisma.milestone.findMany({
        where: {
          dueDate: { gte: from, lte: to },
          goal: {
            workspaceId: membership.workspaceId,
            ...(query.projectId
              ? { projects: { some: { projectId: query.projectId } } }
              : {}),
            ...(query.userId ? { ownerId: query.userId } : {}),
          },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          goal: {
            select: {
              id: true,
              ownerId: true,
              projects: { select: { projectId: true, project: { select: { teamId: true } } } },
            },
          },
        },
      });
      for (const milestone of milestones) {
        if (!milestone.dueDate || !milestone.goal) continue;
        const goal = milestone.goal;
        const projectIds = goal.projects.map((item) => item.projectId);
        const teamId = goal.projects[0]?.project.teamId ?? null;
        if (query.teamId && teamId !== query.teamId) continue;
        events.push({
          id: `milestone:${milestone.id}`,
          type: 'milestone',
          title: milestone.title,
          startAt: milestone.dueDate.toISOString(),
          href: `/app/goals/${goal.id}`,
          projectId: projectIds[0] ?? null,
          teamId,
          userIds: [goal.ownerId],
        });
      }
    }

    events.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return { from: from.toISOString(), to: to.toISOString(), events };
  }

  async create(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: CreateMeetingDto,
  ) {
    assertCanMutate(membership);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.assertRange(startAt, endAt);
    if (dto.projectId) {
      await this.assertUsableProject(membership.workspaceId, dto.projectId);
    }
    if (dto.teamId) {
      await this.assertTeamInWorkspace(membership.workspaceId, dto.teamId);
    }
    const participantRows = await this.normalizeParticipantRows(
      membership.workspaceId,
      userId,
      dto,
    );
    const agenda = (dto.agenda ?? [])
      .map((title) => title.trim())
      .filter(Boolean);
    const meetingUrl = (dto.meetingUrl ?? dto.meetingLink)?.trim() || null;
    const mode =
      dto.mode ?? (meetingUrl ? MeetingMode.ONLINE : MeetingMode.OFFLINE);
    const remindMinutes = normalizeRemindMinutes(
      dto.remindMinutes,
      dto.remindMinutesBefore,
    );

    const meeting = await this.prisma.meeting.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startAt,
        endAt,
        mode,
        meetingProvider: dto.meetingProvider ?? null,
        meetingLink: meetingUrl,
        location: dto.location?.trim() || null,
        room: dto.room?.trim() || null,
        address: dto.address?.trim() || null,
        mapUrl: dto.mapUrl?.trim() || null,
        notes: dto.notes?.trim() || null,
        discussion: dto.discussion?.trim() || dto.notes?.trim() || null,
        decisions: dto.decisions?.trim() || null,
        projectId: dto.projectId ?? null,
        teamId: dto.teamId ?? null,
        organizerId: userId,
        workspaceId: membership.workspaceId,
        remindMinutes,
        recurrence: dto.recurrence ?? MeetingRecurrence.NONE,
        recurrenceUntil: dto.recurrenceUntil
          ? new Date(dto.recurrenceUntil)
          : null,
        recurrenceWeekdays: dto.recurrenceWeekdays ?? [],
        participants: {
          create: participantRows.map((row) => ({
            userId: row.userId,
            kind: row.kind,
            response:
              row.userId === userId
                ? MeetingResponse.ACCEPTED
                : MeetingResponse.PENDING,
            respondedAt: row.userId === userId ? new Date() : null,
          })),
        },
        agendaItems: {
          create: agenda.map((title, position) => ({ title, position })),
        },
      },
      select: meetingSelect,
    });

    await this.reminders.scheduleMeetingReminder(
      meeting.id,
      startAt,
      remindMinutes,
    );
    const invitees = participantRows
      .map((row) => row.userId)
      .filter((id) => id !== userId);
    if (invitees.length) {
      await this.notifications.notify({
        workspaceId: membership.workspaceId,
        userIds: invitees,
        type: NotificationType.MEETING_INVITE,
        title: 'Meeting invitation',
        message: meeting.title,
        entityId: meeting.id,
        entityType: 'meeting',
        meetingId: meeting.id,
      });
    }
    await this.automations.dispatch({
      workspaceId: membership.workspaceId,
      trigger: AutomationTrigger.MEETING_CREATED,
      actorUserId: userId,
      title: meeting.title,
      entityId: meeting.id,
      entityType: 'meeting',
      assigneeIds: participantRows.map((row) => row.userId),
    });
    await this.activity?.log({
      workspaceId: membership.workspaceId,
      actorId: userId,
      type: ActivityType.MEETING_SCHEDULED,
      title: `scheduled a meeting`,
      entityType: 'meeting',
      entityId: meeting.id,
    });
    return this.toMeeting(meeting);
  }

  async update(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
    dto: UpdateMeetingDto,
  ) {
    assertCanMutate(membership);
    const current = await this.requireMeeting(
      membership.workspaceId,
      meetingId,
    );
    if (isNotesOnlyPatch(dto)) {
      this.assertCanContributeNotes(membership, userId, current);
    } else {
      this.assertCanManage(
        membership,
        userId,
        current.organizerId,
        current.status,
      );
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : current.endAt;
    this.assertRange(startAt, endAt);

    if (dto.projectId) {
      await this.assertUsableProject(membership.workspaceId, dto.projectId);
    }
    if (dto.teamId) {
      await this.assertTeamInWorkspace(membership.workspaceId, dto.teamId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.participantIds || dto.participants) {
        const participantRows = await this.normalizeParticipantRows(
          membership.workspaceId,
          current.organizerId,
          dto,
        );
        await tx.meetingParticipant.deleteMany({ where: { meetingId } });
        for (const row of participantRows) {
          await tx.meetingParticipant.create({
            data: {
              meetingId,
              userId: row.userId,
              kind: row.kind,
            },
          });
        }
      }
      if (dto.agenda) {
        const agenda = dto.agenda.map((title) => title.trim()).filter(Boolean);
        await tx.meetingAgendaItem.deleteMany({ where: { meetingId } });
        for (const [position, title] of agenda.entries()) {
          await tx.meetingAgendaItem.create({
            data: { meetingId, title, position },
          });
        }
      }
      const meetingUrl =
        dto.meetingUrl !== undefined
          ? dto.meetingUrl?.trim() || null
          : dto.meetingLink !== undefined
            ? dto.meetingLink?.trim() || null
            : undefined;
      const remindMinutes =
        dto.remindMinutes !== undefined || dto.remindMinutesBefore !== undefined
          ? normalizeRemindMinutes(dto.remindMinutes, dto.remindMinutesBefore)
          : undefined;
      return tx.meeting.update({
        where: { id: meetingId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.startAt !== undefined ? { startAt } : {}),
          ...(dto.endAt !== undefined ? { endAt } : {}),
          ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
          ...(dto.meetingProvider !== undefined
            ? { meetingProvider: dto.meetingProvider }
            : {}),
          ...(meetingUrl !== undefined ? { meetingLink: meetingUrl } : {}),
          ...(dto.location !== undefined
            ? { location: dto.location?.trim() || null }
            : {}),
          ...(dto.room !== undefined ? { room: dto.room?.trim() || null } : {}),
          ...(dto.address !== undefined
            ? { address: dto.address?.trim() || null }
            : {}),
          ...(dto.mapUrl !== undefined
            ? { mapUrl: dto.mapUrl?.trim() || null }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
          ...(dto.discussion !== undefined
            ? { discussion: dto.discussion?.trim() || null }
            : {}),
          ...(dto.decisions !== undefined
            ? { decisions: dto.decisions?.trim() || null }
            : {}),
          ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
          ...(dto.teamId !== undefined ? { teamId: dto.teamId } : {}),
          ...(remindMinutes !== undefined ? { remindMinutes } : {}),
          ...(dto.recurrence !== undefined ? { recurrence: dto.recurrence } : {}),
          ...(dto.recurrenceUntil !== undefined
            ? {
                recurrenceUntil: dto.recurrenceUntil
                  ? new Date(dto.recurrenceUntil)
                  : null,
              }
            : {}),
          ...(dto.recurrenceWeekdays !== undefined
            ? { recurrenceWeekdays: dto.recurrenceWeekdays }
            : {}),
        },
        select: meetingSelect,
      });
    });

    if (
      dto.startAt !== undefined ||
      dto.remindMinutes !== undefined ||
      dto.remindMinutesBefore !== undefined
    ) {
      await this.reminders.cancelMeetingReminder(meetingId);
      if (
        updated.status !== MeetingStatus.CANCELLED &&
        updated.status !== MeetingStatus.COMPLETED
      ) {
        await this.reminders.scheduleMeetingReminder(
          meetingId,
          updated.startAt,
          updated.remindMinutes,
        );
      }
    }
    return this.toMeeting(updated);
  }

  async rsvp(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
    response: MeetingResponse,
  ) {
    const meeting = await this.requireMeeting(
      membership.workspaceId,
      meetingId,
    );
    const participant = meeting.participants.find(
      (item) => item.userId === userId,
    );
    if (!participant) {
      throw new ForbiddenException('You are not invited to this meeting');
    }
    await this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { response, respondedAt: new Date() },
    });
    return this.findById(membership, meetingId);
  }

  async replaceAgenda(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
    agenda: string[],
  ) {
    return this.update(membership, userId, meetingId, { agenda });
  }

  async createActionItem(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
    dto: CreateActionItemDto,
  ) {
    assertCanMutate(membership);
    const meeting = await this.requireMeeting(
      membership.workspaceId,
      meetingId,
    );
    this.assertCanManage(
      membership,
      userId,
      meeting.organizerId,
      meeting.status,
    );
    if (dto.assigneeId) {
      await this.assertActiveMember(membership.workspaceId, dto.assigneeId);
    }
    const last = meeting.actionItems[meeting.actionItems.length - 1];
    await this.prisma.meetingActionItem.create({
      data: {
        meetingId,
        workspaceId: membership.workspaceId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        assigneeId: dto.assigneeId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        position: (last?.position ?? -1) + 1,
      },
    });
    return this.findById(membership, meetingId);
  }

  async updateActionItem(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
    itemId: string,
    dto: UpdateActionItemDto,
  ) {
    assertCanMutate(membership);
    const meeting = await this.requireMeeting(
      membership.workspaceId,
      meetingId,
    );
    this.assertCanManage(
      membership,
      userId,
      meeting.organizerId,
      meeting.status,
    );
    const item = meeting.actionItems.find((row) => row.id === itemId);
    if (!item) {
      throw new NotFoundException('Action item not found');
    }
    if (dto.assigneeId) {
      await this.assertActiveMember(membership.workspaceId, dto.assigneeId);
    }
    await this.prisma.meetingActionItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.done !== undefined ? { done: dto.done } : {}),
      },
    });
    return this.findById(membership, meetingId);
  }

  async convertActionItem(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
    itemId: string,
    dto: ConvertActionItemDto,
  ) {
    assertCanMutate(membership);
    const meeting = await this.requireMeeting(
      membership.workspaceId,
      meetingId,
    );
    this.assertCanManage(
      membership,
      userId,
      meeting.organizerId,
      meeting.status,
    );
    const item = meeting.actionItems.find((row) => row.id === itemId);
    if (!item) {
      throw new NotFoundException('Action item not found');
    }
    if (item.taskId) {
      throw new BadRequestException('This action item already has a task');
    }
    const task = await this.tasks.create(membership, userId, {
      title: dto.title?.trim() || item.title,
      description: item.description
        ? `${item.description}\n\nCreated from meeting: ${meeting.title}`
        : `Created from meeting: ${meeting.title}`,
      projectId: dto.projectId ?? meeting.projectId ?? undefined,
      assigneeId: dto.assigneeId ?? item.assigneeId ?? undefined,
      dueDate: dto.dueDate ?? item.dueDate?.toISOString(),
      priority: dto.priority,
      meetingId: meeting.id,
    });
    await this.prisma.meetingActionItem.update({
      where: { id: itemId },
      data: { taskId: task.id, done: true },
    });
    return this.findById(membership, meetingId);
  }

  async cancel(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
  ) {
    assertCanMutate(membership);
    const meeting = await this.requireMeeting(
      membership.workspaceId,
      meetingId,
    );
    this.assertCanManage(
      membership,
      userId,
      meeting.organizerId,
      meeting.status,
    );
    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: MeetingStatus.CANCELLED },
      select: meetingSelect,
    });
    await this.reminders.cancelMeetingReminder(meeting.id);
    await this.notifications.notify({
      workspaceId: membership.workspaceId,
      userIds: meeting.participants
        .map((item) => item.userId)
        .filter((id) => id !== userId),
      type: NotificationType.MEETING_CANCELLED,
      title: 'Meeting cancelled',
      message: meeting.title,
      entityId: meeting.id,
      entityType: 'meeting',
      meetingId: meeting.id,
    });
    return this.toMeeting(updated);
  }

  async complete(
    membership: WorkspaceMembershipContext,
    userId: string,
    meetingId: string,
  ) {
    assertCanMutate(membership);
    const meeting = await this.requireMeeting(
      membership.workspaceId,
      meetingId,
    );
    this.assertCanManage(
      membership,
      userId,
      meeting.organizerId,
      meeting.status,
    );
    if (meeting.status === MeetingStatus.CANCELLED) {
      throw new BadRequestException('A cancelled meeting cannot be completed');
    }
    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: MeetingStatus.COMPLETED },
      select: meetingSelect,
    });
    await this.reminders.cancelMeetingReminder(meeting.id);
    return this.toMeeting(updated);
  }

  private async requireMeeting(workspaceId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId },
      select: meetingSelect,
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }

  private assertCanManage(
    membership: WorkspaceMembershipContext,
    userId: string,
    organizerId: string,
    status: MeetingStatus,
  ) {
    if (status === MeetingStatus.CANCELLED) {
      throw new BadRequestException('Cancelled meetings cannot be changed');
    }
    if (!canAdminister(membership.role) && organizerId !== userId) {
      throw new ForbiddenException(
        'Only the organizer can change this meeting',
      );
    }
  }

  private assertCanContributeNotes(
    membership: WorkspaceMembershipContext,
    userId: string,
    meeting: MeetingRecord,
  ) {
    if (meeting.status === MeetingStatus.CANCELLED) {
      throw new BadRequestException('Cancelled meetings cannot be changed');
    }
    if (canAdminister(membership.role) || meeting.organizerId === userId) {
      return;
    }
    if (meeting.participants.some((row) => row.userId === userId)) {
      return;
    }
    throw new ForbiddenException(
      'Only meeting participants can update notes',
    );
  }

  private assertRange(startAt: Date, endAt: Date) {
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('Meeting end must be after start');
    }
  }

  private async assertUsableProject(workspaceId: string, projectId: string) {
    const project = await this.projectsService.assertProjectInWorkspace(
      workspaceId,
      projectId,
    );
    if (project.status === ProjectStatus.ARCHIVED) {
      throw new BadRequestException('Cannot link an archived project');
    }
  }

  private async assertTeamInWorkspace(workspaceId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, workspaceId },
      select: { id: true },
    });
    if (!team) {
      throw new BadRequestException('Team not found in this workspace');
    }
  }

  private async assertActiveMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new BadRequestException('Assignee must be an active workspace member');
    }
  }

  private async normalizeParticipantRows(
    workspaceId: string,
    organizerId: string,
    dto: { participantIds?: string[]; participants?: MeetingParticipantInputDto[] },
  ) {
    const byUser = new Map<string, MeetingParticipantKind>();
    byUser.set(organizerId, MeetingParticipantKind.REQUIRED);
    for (const id of dto.participantIds ?? []) {
      if (id) byUser.set(id, MeetingParticipantKind.REQUIRED);
    }
    for (const row of dto.participants ?? []) {
      if (row.userId) {
        byUser.set(
          row.userId,
          row.kind ?? MeetingParticipantKind.REQUIRED,
        );
      }
    }
    const unique = [...byUser.keys()];
    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: unique },
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: { userId: true },
    });
    if (members.length !== unique.length) {
      throw new BadRequestException(
        'Participants must be active workspace members',
      );
    }
    return unique.map((userId) => ({
      userId,
      kind: byUser.get(userId) ?? MeetingParticipantKind.REQUIRED,
    }));
  }

  private toMeeting(meeting: MeetingRecord) {
    const { participants, agendaItems, actionItems, tasks, meetingLink, ...rest } =
      meeting;
    const now = Date.now();
    const liveStatus =
      meeting.status === MeetingStatus.SCHEDULED &&
      now >= meeting.startAt.getTime() &&
      now <= meeting.endAt.getTime()
        ? MeetingStatus.IN_PROGRESS
        : meeting.status;
    return {
      ...rest,
      startAt: meeting.startAt.toISOString(),
      endAt: meeting.endAt.toISOString(),
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
      recurrenceUntil: meeting.recurrenceUntil?.toISOString() ?? null,
      status: liveStatus,
      meetingUrl: meetingLink,
      meetingLink,
      durationMinutes: Math.max(
        1,
        Math.round((meeting.endAt.getTime() - meeting.startAt.getTime()) / 60000),
      ),
      participants: participants.map((item) => ({
        ...item.user,
        userId: item.userId,
        kind: item.kind,
        response: item.response,
        respondedAt: item.respondedAt,
        user: item.user,
      })),
      agenda: agendaItems,
      actionItems: actionItems.map((item) => ({
        ...item,
        dueDate: item.dueDate?.toISOString() ?? null,
      })),
      linkedTasks: tasks.map((task) => ({
        ...task,
        dueDate: task.dueDate?.toISOString() ?? null,
      })),
    };
  }
}

type CalendarEvent = {
  id: string;
  type: 'meeting' | 'task' | 'deadline' | 'milestone';
  title: string;
  startAt: string;
  endAt?: string | null;
  href: string;
  status?: string;
  projectId?: string | null;
  teamId?: string | null;
  userIds: string[];
};

function occurrenceView(
  meeting: ReturnType<MeetingsService['toMeeting']>,
  startAt: Date,
  originalEnd: Date,
) {
  const duration = originalEnd.getTime() - new Date(meeting.startAt).getTime();
  const endAt = new Date(startAt.getTime() + duration);
  return {
    ...meeting,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    occurrenceStart: startAt.toISOString(),
  };
}

function rangeWindow(query: ListMeetingsQueryDto) {
  if (query.from || query.to) {
    return {
      from: query.from ? new Date(query.from) : new Date(0),
      to: query.to ? new Date(query.to) : new Date('9999-12-31'),
    };
  }
  if (!query.range) {
    return null;
  }
  const now = new Date();
  const startToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const endToday = new Date(startToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  if (query.range === 'today') {
    return { from: startToday, to: endToday };
  }
  if (query.range === 'week') {
    return {
      from: startToday,
      to: new Date(startToday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
    };
  }
  if (query.range === 'past') {
    return { from: new Date(0), to: now };
  }
  return {
    from: now,
    to: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
  };
}

function normalizeRemindMinutes(
  minutes?: number[],
  legacy?: number,
) {
  if (minutes !== undefined) {
    return [
      ...new Set(
        minutes.filter((item) => ALLOWED_REMIND_MINUTES.includes(item)),
      ),
    ];
  }
  if (legacy !== undefined) {
    return legacy > 0 && ALLOWED_REMIND_MINUTES.includes(legacy)
      ? [legacy]
      : [];
  }
  return [15];
}

const NOTES_PATCH_KEYS = new Set(['notes', 'discussion', 'decisions']);

function isNotesOnlyPatch(dto: UpdateMeetingDto) {
  const keys = (Object.keys(dto) as (keyof UpdateMeetingDto)[]).filter(
    (key) => dto[key] !== undefined,
  );
  return (
    keys.length > 0 &&
    keys.every((key) => NOTES_PATCH_KEYS.has(key))
  );
}

function inRange(value: Date, from: Date, to: Date) {
  return value >= from && value <= to;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}
