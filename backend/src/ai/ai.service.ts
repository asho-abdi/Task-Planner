import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiClient } from './ai.client';
import {
  heuristicAssist,
  heuristicExtract,
  heuristicNarrative,
  heuristicPlan,
  heuristicPlanDay,
} from './ai.heuristics';
import {
  asSuggestedTasks,
  asTrimmedString,
  AiEnvelope,
  SuggestedTask,
} from './ai.types';
import {
  AssistAiDto,
  ExtractAiDto,
  PlanAiDto,
  PlanDayDto,
  ReportNarrativeDto,
} from './dto/ai.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { WorkspaceMembershipContext } from '../common/types/request-context';

type WithEnvelope<T> = T & AiEnvelope;

@Injectable()
export class AiService {
  constructor(
    private readonly client: AiClient,
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  status() {
    const enabled = this.client.isConfigured();
    return {
      enabled,
      source: enabled ? ('ai' as const) : ('heuristic' as const),
    };
  }

  async plan(
    membership: WorkspaceMembershipContext,
    dto: PlanAiDto,
  ): Promise<
    WithEnvelope<{ title: string; summary: string; tasks: SuggestedTask[] }>
  > {
    const project = dto.projectId
      ? await this.requireProject(membership.workspaceId, dto.projectId)
      : null;
    const fallback = heuristicPlan(dto.prompt, project?.name);
    const result = await this.client.completeJson(
      'You are a project planner. Reply with JSON: {"title":string,"summary":string,"tasks":[{"title":string,"description":string,"priority":"LOW|MEDIUM|HIGH|URGENT","estimatedHours":number}]}. Do not create work in any system.',
      `Project: ${project?.name ?? 'none'}\nRequest:\n${dto.prompt}`,
    );
    if (!result.ok) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: result.reason,
      };
    }
    const data = result.data as Record<string, unknown>;
    const tasks = asSuggestedTasks(data.tasks);
    const title = asTrimmedString(data.title);
    const summary = asTrimmedString(data.summary);
    if (!title || !summary || tasks.length === 0) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: 'invalid_response',
      };
    }
    return { title, summary, tasks, source: 'ai' };
  }

  async assist(
    membership: WorkspaceMembershipContext,
    dto: AssistAiDto,
  ): Promise<WithEnvelope<{ answer: string; suggestions: string[] }>> {
    const task = dto.taskId
      ? await this.requireTask(membership.workspaceId, dto.taskId)
      : null;
    const project = dto.projectId
      ? await this.requireProject(membership.workspaceId, dto.projectId)
      : null;
    const fallback = heuristicAssist(dto.question, {
      title: task?.title ?? project?.name,
      status: task?.status,
    });
    const result = await this.client.completeJson(
      'You are a concise task assistant. Reply with JSON: {"answer":string,"suggestions":string[]}.',
      `Task: ${task?.title ?? 'none'} (${task?.status ?? 'n/a'})\nProject: ${project?.name ?? 'none'}\nQuestion:\n${dto.question}`,
    );
    if (!result.ok) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: result.reason,
      };
    }
    const data = result.data as Record<string, unknown>;
    const answer = asTrimmedString(data.answer);
    const suggestions = Array.isArray(data.suggestions)
      ? data.suggestions
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];
    if (!answer) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: 'invalid_response',
      };
    }
    return {
      answer,
      suggestions,
      source: 'ai',
    };
  }

  async extract(
    membership: WorkspaceMembershipContext,
    dto: ExtractAiDto,
  ): Promise<WithEnvelope<{ tasks: SuggestedTask[] }>> {
    const meeting = dto.meetingId
      ? await this.requireMeeting(membership.workspaceId, dto.meetingId)
      : null;
    const parts = [
      meeting?.title,
      meeting?.description,
      meeting?.notes,
      ...(meeting?.agendaItems.map((item) => item.title) ?? []),
      dto.text,
    ]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part));
    if (parts.length === 0) {
      throw new BadRequestException(
        'Provide notes text or a meeting to extract tasks from',
      );
    }
    const sourceText = parts.join('\n');
    const fallback = heuristicExtract(sourceText);
    const result = await this.client.completeJson(
      'Extract actionable tasks. Reply with JSON: {"tasks":[{"title":string,"description":string,"priority":"LOW|MEDIUM|HIGH|URGENT","dueDate":"YYYY-MM-DD"}]}.',
      sourceText,
    );
    if (!result.ok) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: result.reason,
      };
    }
    const tasks = asSuggestedTasks(
      (result.data as Record<string, unknown>).tasks,
    );
    if (tasks.length === 0) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: 'invalid_response',
      };
    }
    return { tasks, source: 'ai' };
  }

  async reportNarrative(
    membership: WorkspaceMembershipContext,
    dto: ReportNarrativeDto,
  ): Promise<
    WithEnvelope<{ headline: string; narrative: string; highlights: string[] }>
  > {
    const report = await this.reports.getReports(membership, {
      from: dto.from,
      to: dto.to,
      page: 1,
      pageSize: 5,
    });
    const topProject = report.projectPerformance.items[0]?.name;
    const fallback = heuristicNarrative({
      from: report.from,
      to: report.to,
      completionRate: report.completion.completionRate,
      completed: report.completion.completed,
      open: report.completion.open,
      overdue: report.overdue.count,
      overloaded: report.workload.overloadedCount,
      topProject,
    });
    const result = await this.client.completeJson(
      'Write a short workspace report. Reply with JSON: {"headline":string,"narrative":string,"highlights":string[]}. Use only the supplied numbers.',
      JSON.stringify({
        from: report.from,
        to: report.to,
        completion: report.completion,
        overdue: report.overdue,
        workload: report.workload,
        projects: report.projectPerformance.items.map((item) => ({
          name: item.name,
          overdue: item.overdue,
          completionRate: item.completionRate,
        })),
      }),
    );
    if (!result.ok) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: result.reason,
      };
    }
    const data = result.data as Record<string, unknown>;
    const headline = asTrimmedString(data.headline);
    const narrative = asTrimmedString(data.narrative);
    const highlights = Array.isArray(data.highlights)
      ? data.highlights
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];
    if (!headline || !narrative) {
      return {
        ...fallback,
        source: 'heuristic',
        unavailableReason: 'invalid_response',
      };
    }
    return { headline, narrative, highlights, source: 'ai' };
  }

  async planDay(
    membership: WorkspaceMembershipContext,
    userId: string,
    dto: PlanDayDto,
  ): Promise<
    WithEnvelope<{
      date: string;
      summary: string;
      slots: Array<{
        taskId: string;
        title: string;
        scheduledStart: string;
        scheduledEnd: string;
      }>;
    }>
  > {
    const date = dto.date ?? new Date().toISOString().slice(0, 10);
    const myDay = await this.reports.getMyDay(membership, userId, { date });
    const taskIds = myDay.assignedWork.items.map((item) => item.id);
    const tasks = taskIds.length
      ? await this.prisma.task.findMany({
          where: { workspaceId: membership.workspaceId, id: { in: taskIds } },
          select: { id: true, title: true, estimatedMinutes: true },
        })
      : [];
    const ordered = taskIds
      .map((id) => tasks.find((task) => task.id === id))
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
    const fallback = heuristicPlanDay(
      date,
      ordered,
      myDay.meetings.items.map((meeting) => ({
        startAt: new Date(meeting.startAt),
        endAt: new Date(meeting.endAt),
      })),
    );
    const result = await this.client.completeJson(
      'Plan a workday around meetings. Reply with JSON: {"summary":string,"slots":[{"taskId":string,"title":string,"scheduledStart":string,"scheduledEnd":string}]}. Only use the supplied task ids. ISO timestamps.',
      JSON.stringify({
        date,
        tasks: ordered,
        meetings: myDay.meetings.items,
        fallback,
      }),
    );
    if (!result.ok) {
      return { date, ...fallback, source: 'heuristic', unavailableReason: result.reason };
    }
    const data = result.data as Record<string, unknown>;
    const summary = asTrimmedString(data.summary) || fallback.summary;
    const slots = Array.isArray(data.slots)
      ? data.slots.flatMap((item) => {
          if (!item || typeof item !== 'object') {
            return [];
          }
          const row = item as Record<string, unknown>;
          const taskId = asTrimmedString(row.taskId);
          const title = asTrimmedString(row.title);
          const scheduledStart = asTrimmedString(row.scheduledStart);
          const scheduledEnd = asTrimmedString(row.scheduledEnd);
          if (!taskId || !title || !scheduledStart || !scheduledEnd) {
            return [];
          }
          if (!taskIds.includes(taskId)) {
            return [];
          }
          return [{ taskId, title, scheduledStart, scheduledEnd }];
        })
      : [];
    if (slots.length === 0) {
      return {
        date,
        ...fallback,
        source: 'heuristic',
        unavailableReason: 'invalid_response',
      };
    }
    return { date, summary, slots, source: 'ai' };
  }

  private async requireProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async requireTask(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      select: { id: true, title: true, status: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async requireMeeting(workspaceId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId },
      select: {
        id: true,
        title: true,
        description: true,
        notes: true,
        agendaItems: { select: { title: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }
}
