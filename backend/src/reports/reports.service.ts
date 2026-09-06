import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DependencyType,
  MeetingStatus,
  Prisma,
  ProjectStatus,
  TaskStatus,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { canAdminister } from '../common/permissions';
import { WorkspaceMembershipContext } from '../common/types/request-context';
import {
  DateQueryDto,
  ReportsQueryDto,
  RiskQueryDto,
  WorkloadQueryDto,
} from './reports.dto';
import {
  blockedTaskIds,
  computeTaskRiskScore,
  eachUtcDate,
  hoursFromMinutes,
  inRange,
  isOverloaded,
  OPEN_TASK_STATUSES,
  parseUtcDate,
  roundHours,
  utcDayRange,
  utcRangeDays,
  utcWeekRange,
} from './scoring';

const CACHE_TTL_SECONDS = 30;
const MY_DAY_LIMIT = 20;

const insightTaskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  startDate: true,
  scheduledStart: true,
  estimatedMinutes: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  assignees: {
    select: { user: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.TaskSelect;

type InsightTaskRecord = Prisma.TaskGetPayload<{
  select: typeof insightTaskSelect;
}>;

type WorkloadRow = {
  userId: string;
  name: string;
  email: string;
  todayMinutes: number;
  openMinutes: number;
  unestimatedCount: number;
  openTaskCount: number;
  weekDeadlineCount?: number;
  total: number;
};

type DayCountRow = {
  day: string;
  count: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async getMyDay(
    membership: WorkspaceMembershipContext,
    userId: string,
    query: DateQueryDto,
    now = new Date(),
  ) {
    const hoursPerDay = this.hoursPerDay();
    const { start, end, date } = this.resolveDay(query.date, now);
    return this.cached(
      `insights:my-day:v3:${membership.workspaceId}:${userId}:${date}`,
      async () => {
        const assignedOpen: Prisma.TaskWhereInput = {
          workspaceId: membership.workspaceId,
          status: { in: OPEN_TASK_STATUSES },
          ...(canAdminister(membership.role)
            ? {}
            : {
                OR: [
                  { ownerId: userId },
                  { assignees: { some: { userId } } },
                ],
              }),
        };
        const scheduledOnDay: Prisma.TaskWhereInput = {
          OR: [
            { startDate: { gte: start, lt: end } },
            { scheduledStart: { gte: start, lt: end } },
          ],
        };

        const meetingWhere: Prisma.MeetingWhereInput = {
          workspaceId: membership.workspaceId,
          status: { not: MeetingStatus.CANCELLED },
          startAt: { gte: start, lt: end },
          ...(canAdminister(membership.role)
            ? {}
            : {
                OR: [
                  { organizerId: userId },
                  { participants: { some: { userId } } },
                ],
              }),
        };

        const [
          todayTasks,
          todayTaskCount,
          meetings,
          meetingCount,
          dueTasks,
          dueTaskCount,
          assignedWork,
          assignedCount,
          scheduledWork,
          scheduledCount,
        ] = await Promise.all([
          this.prisma.task.findMany({
            where: {
              ...assignedOpen,
              OR: [
                { dueDate: { gte: start, lt: end } },
                { startDate: { gte: start, lt: end } },
                { scheduledStart: { gte: start, lt: end } },
                { status: TaskStatus.IN_PROGRESS },
              ],
            },
            select: insightTaskSelect,
            orderBy: [
              { dueDate: { sort: 'asc', nulls: 'last' } },
              { title: 'asc' },
            ],
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({
            where: {
              ...assignedOpen,
              OR: [
                { dueDate: { gte: start, lt: end } },
                { startDate: { gte: start, lt: end } },
                { scheduledStart: { gte: start, lt: end } },
                { status: TaskStatus.IN_PROGRESS },
              ],
            },
          }),
          this.prisma.meeting.findMany({
            where: meetingWhere,
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              status: true,
              mode: true,
              location: true,
              meetingLink: true,
              project: { select: { id: true, name: true } },
              team: { select: { id: true, name: true } },
            },
            orderBy: { startAt: 'asc' },
            take: MY_DAY_LIMIT,
          }),
          this.prisma.meeting.count({
            where: meetingWhere,
          }),
          this.prisma.task.findMany({
            where: {
              ...assignedOpen,
              dueDate: { gte: start, lt: end },
            },
            select: insightTaskSelect,
            orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({
            where: {
              ...assignedOpen,
              dueDate: { gte: start, lt: end },
            },
          }),
          this.prisma.task.findMany({
            where: assignedOpen,
            select: insightTaskSelect,
            orderBy: [
              { dueDate: { sort: 'asc', nulls: 'last' } },
              { title: 'asc' },
            ],
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({ where: assignedOpen }),
          this.prisma.task.findMany({
            where: { ...assignedOpen, ...scheduledOnDay },
            select: insightTaskSelect,
            orderBy: [
              { startDate: { sort: 'asc', nulls: 'last' } },
              { title: 'asc' },
            ],
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({
            where: { ...assignedOpen, ...scheduledOnDay },
          }),
        ]);

        const weekEnd = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);
        const recentSince = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
        const overdueWhere: Prisma.TaskWhereInput = {
          ...assignedOpen,
          AND: [
            {
              OR: [
                { status: TaskStatus.OVERDUE },
                { dueDate: { lt: start } },
              ],
            },
          ],
        };
        const upcomingWhere: Prisma.TaskWhereInput = {
          ...assignedOpen,
          dueDate: { gte: end, lt: weekEnd },
        };
        const recentWhere: Prisma.TaskWhereInput = {
          workspaceId: membership.workspaceId,
          updatedAt: { gte: recentSince },
          ...(canAdminister(membership.role)
            ? {}
            : {
                OR: [
                  { ownerId: userId },
                  { assignees: { some: { userId } } },
                ],
              }),
        };

        const completedWhere: Prisma.TaskWhereInput = {
          workspaceId: membership.workspaceId,
          status: TaskStatus.COMPLETED,
          AND: [
            {
              OR: [
                { approvedAt: { gte: start, lt: end } },
                {
                  AND: [
                    { approvedAt: null },
                    { updatedAt: { gte: start, lt: end } },
                  ],
                },
              ],
            },
            ...(canAdminister(membership.role)
              ? []
              : [
                  {
                    OR: [
                      { ownerId: userId },
                      { assignees: { some: { userId } } },
                    ],
                  },
                ]),
          ],
        };

        const [
          overdueTasks,
          overdueCount,
          upcomingDeadlines,
          upcomingCount,
          recentlyUpdated,
          recentlyUpdatedCount,
          completedTasks,
          completedCount,
        ] = await Promise.all([
          this.prisma.task.findMany({
            where: overdueWhere,
            select: insightTaskSelect,
            orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({ where: overdueWhere }),
          this.prisma.task.findMany({
            where: upcomingWhere,
            select: insightTaskSelect,
            orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({ where: upcomingWhere }),
          this.prisma.task.findMany({
            where: recentWhere,
            select: insightTaskSelect,
            orderBy: { updatedAt: 'desc' },
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({ where: recentWhere }),
          this.prisma.task.findMany({
            where: completedWhere,
            select: insightTaskSelect,
            orderBy: { updatedAt: 'desc' },
            take: MY_DAY_LIMIT,
          }),
          this.prisma.task.count({ where: completedWhere }),
        ]);

        return {
          date,
          hoursPerDay,
          todayTasks: this.section(todayTasks, todayTaskCount),
          meetings: {
            items: meetings,
            total: meetingCount,
          },
          dueTasks: this.section(dueTasks, dueTaskCount),
          assignedWork: this.section(assignedWork, assignedCount),
          scheduledWork: this.section(scheduledWork, scheduledCount),
          overdueTasks: this.section(overdueTasks, overdueCount),
          upcomingDeadlines: this.section(upcomingDeadlines, upcomingCount),
          recentlyUpdated: this.section(recentlyUpdated, recentlyUpdatedCount),
          completedTasks: this.section(completedTasks, completedCount),
        };
      },
    );
  }

  async getWorkload(
    membership: WorkspaceMembershipContext,
    query: WorkloadQueryDto,
    now = new Date(),
  ) {
    const hoursPerDay = this.hoursPerDay();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { start, end, date } = this.resolveDay(query.date, now);
    return this.cached(
      `insights:workload:v2:${membership.workspaceId}:${date}:${page}:${pageSize}:${hoursPerDay}`,
      async () => {
        const rows = await this.loadWorkloadRows(
          membership.workspaceId,
          start,
          end,
        );
        const total = rows[0]?.total ?? rows.length;
        const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
        const users = pageRows.map((row) => {
          const todayHours = hoursFromMinutes(row.todayMinutes);
          const openHours = hoursFromMinutes(row.openMinutes);
          const overloaded = isOverloaded(row.todayMinutes, hoursPerDay);
          const weekDeadlines = row.weekDeadlineCount ?? 0;
          return {
            userId: row.userId,
            name: row.name,
            email: row.email,
            todayHours,
            openHours,
            capacityHours: hoursPerDay,
            utilization: hoursPerDay ? roundHours(todayHours / hoursPerDay) : 0,
            overloaded,
            unestimatedCount: row.unestimatedCount,
            openTaskCount: row.openTaskCount,
            weekDeadlineCount: weekDeadlines,
            warning: overloaded
              ? {
                  title: 'High workload',
                  message: `This user has ${row.openTaskCount} active tasks and ${weekDeadlines} deadlines this week.`,
                }
              : null,
          };
        });
        return {
          date,
          hoursPerDay,
          page,
          pageSize,
          total,
          overloadedCount: rows.filter((row) =>
            isOverloaded(row.todayMinutes, hoursPerDay),
          ).length,
          users,
        };
      },
    );
  }

  async getRisk(
    membership: WorkspaceMembershipContext,
    query: RiskQueryDto,
    now = new Date(),
  ) {
    const hoursPerDay = this.hoursPerDay();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { start, end, date } = this.resolveDay(query.date, now);
    return this.cached(
      `insights:risk:${membership.workspaceId}:${date}:${page}:${pageSize}:${hoursPerDay}`,
      async () => {
        const [tasks, edges, loadRows] = await Promise.all([
          this.prisma.task.findMany({
            where: {
              workspaceId: membership.workspaceId,
              status: { in: OPEN_TASK_STATUSES },
            },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              projectId: true,
              assignees: {
                take: 1,
                orderBy: { id: 'asc' },
                select: { userId: true },
              },
            },
          }),
          this.prisma.taskDependency.findMany({
            where: {
              workspaceId: membership.workspaceId,
              type: {
                in: [
                  DependencyType.DEPENDS_ON,
                  DependencyType.BLOCKED_BY,
                  DependencyType.BLOCKS,
                ],
              },
            },
            select: { fromTaskId: true, toTaskId: true, type: true },
          }),
          this.loadWorkloadRows(membership.workspaceId, start, end),
        ]);

        const incompleteIds = new Set(tasks.map((task) => task.id));
        const blocked = blockedTaskIds(edges, incompleteIds);
        const overloadedUsers = new Set(
          loadRows
            .filter((row) => isOverloaded(row.todayMinutes, hoursPerDay))
            .map((row) => row.userId),
        );

        const scored = tasks
          .map((task) => {
            const assigneeId = task.assignees[0]?.userId ?? null;
            const result = computeTaskRiskScore({
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
              blocked: blocked.has(task.id),
              assigneeOverloaded: Boolean(
                assigneeId && overloadedUsers.has(assigneeId),
              ),
              now,
            });
            return {
              id: task.id,
              title: task.title,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
              projectId: task.projectId,
              assigneeId,
              blocked: blocked.has(task.id),
              ...result,
            };
          })
          .sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }
            return a.title.localeCompare(b.title);
          });

        const total = scored.length;
        const pageItems = scored.slice((page - 1) * pageSize, page * pageSize);
        const projectIds = [
          ...new Set(
            pageItems
              .map((item) => item.projectId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const assigneeIds = [
          ...new Set(
            pageItems
              .map((item) => item.assigneeId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const [projects, assignees] = await Promise.all([
          projectIds.length
            ? this.prisma.project.findMany({
                where: {
                  workspaceId: membership.workspaceId,
                  id: { in: projectIds },
                },
                select: { id: true, name: true },
              })
            : Promise.resolve([]),
          assigneeIds.length
            ? this.prisma.user.findMany({
                where: { id: { in: assigneeIds } },
                select: { id: true, name: true },
              })
            : Promise.resolve([]),
        ]);
        const projectName = new Map(
          projects.map((project) => [project.id, project.name]),
        );
        const assigneeName = new Map(
          assignees.map((user) => [user.id, user.name]),
        );

        const overdueCount = scored.filter(
          (item) => item.factors.overdue > 0,
        ).length;
        const blockedCount = scored.filter((item) => item.blocked).length;
        const averageScore =
          total === 0
            ? 0
            : Math.round(
                scored.reduce((sum, item) => sum + item.score, 0) / total,
              );

        return {
          date,
          hoursPerDay,
          page,
          pageSize,
          total,
          summary: {
            openTasks: total,
            overdueCount,
            blockedCount,
            overloadedAssignees: overloadedUsers.size,
            criticalCount: scored.filter((item) => item.level === 'CRITICAL')
              .length,
            highCount: scored.filter((item) => item.level === 'HIGH').length,
            averageScore,
          },
          items: pageItems.map(({ projectId, assigneeId, ...item }) => ({
            ...item,
            assignee: assigneeId
              ? {
                  id: assigneeId,
                  name: assigneeName.get(assigneeId) ?? 'Member',
                }
              : null,
            project: projectId
              ? { id: projectId, name: projectName.get(projectId) ?? 'Project' }
              : null,
          })),
        };
      },
    );
  }

  async getReports(
    membership: WorkspaceMembershipContext,
    query: ReportsQueryDto,
    now = new Date(),
  ) {
    const hoursPerDay = this.hoursPerDay();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const range = utcRangeDays(query.from, query.to, now);
    const from = range.start.toISOString().slice(0, 10);
    const to = new Date(range.end.getTime() - 1).toISOString().slice(0, 10);
    return this.cached(
      `insights:reports:v2:${membership.workspaceId}:${from}:${to}:${page}:${pageSize}:${hoursPerDay}:${query.projectId ?? ''}:${query.teamId ?? ''}:${query.userId ?? ''}`,
      async () => {
        const workspaceId = membership.workspaceId;
        const { start, end } = this.resolveDay(undefined, now);
        const taskWhere = this.reportTaskWhere(workspaceId, query);

        const [
          statusGroups,
          projectGroups,
          priorityGroups,
          createdRows,
          completedRows,
          loadRows,
          overdueCount,
          meetingCount,
          createdCount,
        ] = await Promise.all([
          this.prisma.task.groupBy({
            by: ['status'],
            where: { ...taskWhere, status: { not: TaskStatus.ARCHIVED } },
            _count: { _all: true },
          }),
          this.prisma.task.groupBy({
            by: ['projectId', 'status'],
            where: { ...taskWhere, status: { not: TaskStatus.ARCHIVED } },
            _count: { _all: true },
          }),
          this.prisma.task.groupBy({
            by: ['priority'],
            where: { ...taskWhere, status: { not: TaskStatus.ARCHIVED } },
            _count: { _all: true },
          }),
          this.prisma.$queryRaw<DayCountRow[]>(Prisma.sql`
            SELECT to_char(DATE_TRUNC('day', t."createdAt"), 'YYYY-MM-DD') AS day,
                   COUNT(*)::int AS count
            FROM tasks t
            LEFT JOIN projects p ON p.id = t."projectId"
            WHERE t."workspaceId" = ${workspaceId}
              AND t."createdAt" >= ${range.start}
              AND t."createdAt" < ${range.end}
              ${query.projectId ? Prisma.sql`AND t."projectId" = ${query.projectId}` : Prisma.empty}
              ${query.teamId ? Prisma.sql`AND p."teamId" = ${query.teamId}` : Prisma.empty}
              ${query.userId ? Prisma.sql`AND (
                t."ownerId" = ${query.userId}
                OR EXISTS (
                  SELECT 1 FROM task_assignees ta
                  WHERE ta."taskId" = t.id AND ta."userId" = ${query.userId}
                )
              )` : Prisma.empty}
            GROUP BY 1
            ORDER BY 1
          `),
          this.prisma.$queryRaw<DayCountRow[]>(Prisma.sql`
            SELECT to_char(DATE_TRUNC('day', t."updatedAt"), 'YYYY-MM-DD') AS day,
                   COUNT(*)::int AS count
            FROM tasks t
            LEFT JOIN projects p ON p.id = t."projectId"
            WHERE t."workspaceId" = ${workspaceId}
              AND t.status = 'COMPLETED'
              AND t."updatedAt" >= ${range.start}
              AND t."updatedAt" < ${range.end}
              ${query.projectId ? Prisma.sql`AND t."projectId" = ${query.projectId}` : Prisma.empty}
              ${query.teamId ? Prisma.sql`AND p."teamId" = ${query.teamId}` : Prisma.empty}
              ${query.userId ? Prisma.sql`AND (
                t."ownerId" = ${query.userId}
                OR EXISTS (
                  SELECT 1 FROM task_assignees ta
                  WHERE ta."taskId" = t.id AND ta."userId" = ${query.userId}
                )
              )` : Prisma.empty}
            GROUP BY 1
            ORDER BY 1
          `),
          this.loadWorkloadRows(workspaceId, start, end),
          this.prisma.task.count({
            where: {
              ...taskWhere,
              status: { in: OPEN_TASK_STATUSES },
              OR: [{ status: TaskStatus.OVERDUE }, { dueDate: { lt: now } }],
            },
          }),
          this.prisma.meeting.count({
            where: {
              workspaceId,
              status: { not: MeetingStatus.CANCELLED },
              startAt: { gte: range.start, lt: range.end },
              ...(query.projectId ? { projectId: query.projectId } : {}),
              ...(query.userId
                ? {
                    OR: [
                      { organizerId: query.userId },
                      { participants: { some: { userId: query.userId } } },
                    ],
                  }
                : {}),
            },
          }),
          this.prisma.task.count({
            where: {
              ...taskWhere,
              createdAt: { gte: range.start, lt: range.end },
            },
          }),
        ]);

        const byStatus: Record<string, number> = {};
        let totalOpen = 0;
        let completed = 0;
        for (const group of statusGroups) {
          byStatus[group.status] = group._count._all;
          if (group.status === TaskStatus.COMPLETED) {
            completed = group._count._all;
          } else {
            totalOpen += group._count._all;
          }
        }
        const completionRate =
          completed + totalOpen === 0
            ? 0
            : roundHours(completed / (completed + totalOpen));

        const byPriority: Record<string, number> = {};
        for (const group of priorityGroups) {
          byPriority[group.priority] = group._count._all;
        }

        const createdByDay = new Map(
          createdRows.map((row) => [row.day, row.count]),
        );
        const completedByDay = new Map(
          completedRows.map((row) => [row.day, row.count]),
        );
        const trends = eachUtcDate(range.start, range.end).map((day) => ({
          day,
          created: createdByDay.get(day) ?? 0,
          completed: completedByDay.get(day) ?? 0,
        }));

        const projectStats = new Map<
          string,
          { completed: number; overdue: number; open: number }
        >();
        for (const group of projectGroups) {
          const key = group.projectId ?? '';
          const current = projectStats.get(key) ?? {
            completed: 0,
            overdue: 0,
            open: 0,
          };
          if (group.status === TaskStatus.COMPLETED) {
            current.completed += group._count._all;
          } else if (group.status === TaskStatus.OVERDUE) {
            current.overdue += group._count._all;
            current.open += group._count._all;
          } else {
            current.open += group._count._all;
          }
          projectStats.set(key, current);
        }

        const projectRows = [...projectStats.entries()]
          .map(([projectId, stats]) => {
            const denom = stats.completed + stats.open;
            return {
              projectId: projectId || null,
              completed: stats.completed,
              overdue: stats.overdue,
              open: stats.open,
              total: denom,
              completionRate:
                denom === 0 ? 0 : roundHours(stats.completed / denom),
            };
          })
          .sort((a, b) => {
            if (b.overdue !== a.overdue) {
              return b.overdue - a.overdue;
            }
            return a.completionRate - b.completionRate;
          });

        const totalProjects = projectRows.length;
        const pageProjects = projectRows.slice(
          (page - 1) * pageSize,
          page * pageSize,
        );
        const namedIds = pageProjects
          .map((row) => row.projectId)
          .filter((id): id is string => Boolean(id));
        const projects = namedIds.length
          ? await this.prisma.project.findMany({
              where: { workspaceId, id: { in: namedIds } },
              select: { id: true, name: true },
            })
          : [];
        const names = new Map(
          projects.map((project) => [project.id, project.name]),
        );

        const overloadedCount = loadRows.filter((row) =>
          isOverloaded(row.todayMinutes, hoursPerDay),
        ).length;
        const workloadRows = query.userId
          ? loadRows.filter((row) => row.userId === query.userId)
          : loadRows;

        return {
          from,
          to,
          hoursPerDay,
          completion: {
            byStatus,
            byPriority,
            completed,
            open: totalOpen,
            created: createdCount,
            completionRate,
          },
          overdue: {
            count: overdueCount,
          },
          meetings: {
            count: meetingCount,
          },
          workload: {
            memberCount: workloadRows[0]?.total ?? workloadRows.length,
            overloadedCount: query.userId
              ? workloadRows.filter((row) =>
                  isOverloaded(row.todayMinutes, hoursPerDay),
                ).length
              : overloadedCount,
            todayHours: roundHours(
              workloadRows.reduce(
                (sum, row) => sum + hoursFromMinutes(row.todayMinutes),
                0,
              ),
            ),
            capacityHours: roundHours(
              hoursPerDay * (workloadRows[0]?.total ?? workloadRows.length),
            ),
            users: workloadRows.slice(0, 12).map((row) => ({
              userId: row.userId,
              name: row.name,
              utilization: hoursPerDay
                ? roundHours(hoursFromMinutes(row.todayMinutes) / hoursPerDay)
                : 0,
              overloaded: isOverloaded(row.todayMinutes, hoursPerDay),
              openTaskCount: row.openTaskCount,
              weekDeadlineCount: row.weekDeadlineCount ?? 0,
            })),
          },
          trends,
          projectPerformance: {
            page,
            pageSize,
            total: totalProjects,
            items: pageProjects.map((row) => ({
              ...row,
              name: row.projectId
                ? (names.get(row.projectId) ?? 'Project')
                : 'No project',
            })),
          },
        };
      },
    );
  }

  async getDashboard(
    membership: WorkspaceMembershipContext,
    userId: string,
    now = new Date(),
  ) {
    const hoursPerDay = this.hoursPerDay();
    const { start, end, date } = this.resolveDay(undefined, now);
    const weekEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const deadlineHorizon = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
    return this.cached(
      `insights:dashboard:v2:${membership.workspaceId}:${userId}:${date}:${hoursPerDay}`,
      async () => {
        const workspaceId = membership.workspaceId;
        const taskScope: Prisma.TaskWhereInput = {
          workspaceId,
          ...(canAdminister(membership.role)
            ? {}
            : {
                OR: [
                  { ownerId: userId },
                  { assignees: { some: { userId } } },
                ],
              }),
        };
        const meetingScope: Prisma.MeetingWhereInput = {
          workspaceId,
          status: { not: MeetingStatus.CANCELLED },
          ...(canAdminister(membership.role)
            ? {}
            : {
                OR: [
                  { organizerId: userId },
                  { participants: { some: { userId } } },
                ],
              }),
        };

        const [
          myTasksCount,
          completedCount,
          overdueCount,
          inProgressCount,
          todayTasks,
          upcomingMeetings,
          upcomingMeetingCount,
          activeProjects,
          projectGroups,
          loadRows,
          activity,
          deadlineTasks,
          deadlineMilestones,
          deadlineProjects,
        ] = await Promise.all([
          this.prisma.task.count({
            where: { ...taskScope, status: { in: OPEN_TASK_STATUSES } },
          }),
          this.prisma.task.count({
            where: { ...taskScope, status: TaskStatus.COMPLETED },
          }),
          this.prisma.task.count({
            where: {
              ...taskScope,
              status: { in: OPEN_TASK_STATUSES },
              OR: [{ status: TaskStatus.OVERDUE }, { dueDate: { lt: now } }],
            },
          }),
          this.prisma.task.count({
            where: { ...taskScope, status: TaskStatus.IN_PROGRESS },
          }),
          this.prisma.task.findMany({
            where: {
              ...taskScope,
              status: { in: OPEN_TASK_STATUSES },
              OR: [
                { dueDate: { gte: start, lt: end } },
                { startDate: { gte: start, lt: end } },
                { scheduledStart: { gte: start, lt: end } },
                { status: TaskStatus.IN_PROGRESS },
              ],
            },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              startDate: true,
              estimatedMinutes: true,
              project: { select: { id: true, name: true } },
              owner: { select: { id: true, name: true } },
              assignees: {
                take: 3,
                orderBy: { id: 'asc' },
                select: { user: { select: { id: true, name: true } } },
              },
            },
            orderBy: [
              { dueDate: { sort: 'asc', nulls: 'last' } },
              { title: 'asc' },
            ],
            take: 8,
          }),
          this.prisma.meeting.findMany({
            where: {
              ...meetingScope,
              startAt: { gte: now, lt: weekEnd },
            },
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              status: true,
              mode: true,
              location: true,
              meetingLink: true,
              project: { select: { id: true, name: true } },
              organizer: { select: { id: true, name: true } },
              participants: {
                take: 6,
                select: {
                  user: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { startAt: 'asc' },
            take: 6,
          }),
          this.prisma.meeting.count({
            where: {
              ...meetingScope,
              startAt: { gte: now, lt: weekEnd },
            },
          }),
          this.prisma.project.findMany({
            where: {
              workspaceId,
              status: { not: ProjectStatus.ARCHIVED },
            },
            select: {
              id: true,
              name: true,
              status: true,
              endDate: true,
              owner: { select: { id: true, name: true } },
              assignments: {
                take: 6,
                orderBy: { createdAt: 'asc' },
                select: {
                  user: { select: { id: true, name: true } },
                },
              },
              _count: { select: { tasks: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 6,
          }),
          this.prisma.task.groupBy({
            by: ['projectId', 'status'],
            where: {
              workspaceId,
              projectId: { not: null },
              status: { not: TaskStatus.ARCHIVED },
            },
            _count: { _all: true },
          }),
          this.loadWorkloadRows(workspaceId, start, end),
          this.prisma.activityEvent.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              type: true,
              title: true,
              entityType: true,
              entityId: true,
              createdAt: true,
              actor: { select: { id: true, name: true, email: true } },
            },
          }),
          this.prisma.task.findMany({
            where: {
              ...taskScope,
              status: { in: OPEN_TASK_STATUSES },
              dueDate: { gte: now, lt: deadlineHorizon },
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              project: { select: { name: true } },
            },
            orderBy: { dueDate: 'asc' },
            take: 8,
          }),
          this.prisma.milestone.findMany({
            where: {
              workspaceId,
              dueDate: { gte: now, lt: deadlineHorizon },
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              projectId: true,
              goalId: true,
            },
            orderBy: { dueDate: 'asc' },
            take: 6,
          }),
          this.prisma.project.findMany({
            where: {
              workspaceId,
              status: { not: ProjectStatus.ARCHIVED },
              endDate: { gte: now, lt: deadlineHorizon },
            },
            select: { id: true, name: true, endDate: true },
            orderBy: { endDate: 'asc' },
            take: 4,
          }),
        ]);

        const projectStats = new Map<
          string,
          { completed: number; open: number }
        >();
        for (const group of projectGroups) {
          if (!group.projectId) continue;
          const current = projectStats.get(group.projectId) ?? {
            completed: 0,
            open: 0,
          };
          if (group.status === TaskStatus.COMPLETED) {
            current.completed += group._count._all;
          } else {
            current.open += group._count._all;
          }
          projectStats.set(group.projectId, current);
        }

        const projectProgress = activeProjects.map((project) => {
          const stats = projectStats.get(project.id) ?? {
            completed: 0,
            open: 0,
          };
          const denom = stats.completed + stats.open;
          const members = [
            project.owner,
            ...project.assignments
              .map((item) => item.user)
              .filter((person) => person.id !== project.owner.id),
          ];
          return {
            projectId: project.id,
            name: project.name,
            status: project.status,
            dueDate: project.endDate,
            completed: stats.completed,
            open: stats.open,
            percent:
              denom === 0 ? 0 : Math.round((stats.completed / denom) * 100),
            members,
          };
        });

        const upcomingDeadlines = [
          ...deadlineTasks.map((task) => ({
            id: `task:${task.id}`,
            title: task.title,
            dueDate: task.dueDate!,
            kind: 'task' as const,
            href: `/app/tasks/${task.id}`,
            meta: task.project?.name ?? 'Task',
          })),
          ...deadlineMilestones.map((item) => ({
            id: `milestone:${item.id}`,
            title: item.title,
            dueDate: item.dueDate!,
            kind: 'milestone' as const,
            href: item.projectId
              ? `/app/projects/${item.projectId}`
              : item.goalId
                ? `/app/goals/${item.goalId}`
                : '/app/calendar',
            meta: 'Milestone',
          })),
          ...deadlineProjects.map((project) => ({
            id: `project:${project.id}`,
            title: project.name,
            dueDate: project.endDate!,
            kind: 'project' as const,
            href: `/app/projects/${project.id}`,
            meta: 'Project',
          })),
        ]
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
          .slice(0, 6);

        const calendarEvents = [
          ...upcomingMeetings
            .filter((meeting) => meeting.startAt.getTime() < end.getTime())
            .map((meeting) => ({
              id: `meeting:${meeting.id}`,
              type: 'meeting' as const,
              title: meeting.title,
              startAt: meeting.startAt,
              href: `/app/meetings/${meeting.id}`,
            })),
          ...todayTasks
            .filter((task) => task.dueDate && inRange(task.dueDate, start, end))
            .map((task) => ({
              id: `deadline:${task.id}`,
              type: 'deadline' as const,
              title: task.title,
              startAt: task.dueDate!,
              href: `/app/tasks/${task.id}`,
            })),
          ...deadlineMilestones
            .filter(
              (item) => item.dueDate && inRange(item.dueDate, start, end),
            )
            .map((item) => ({
              id: `milestone:${item.id}`,
              type: 'milestone' as const,
              title: item.title,
              startAt: item.dueDate!,
              href: item.projectId
                ? `/app/projects/${item.projectId}`
                : '/app/calendar',
            })),
        ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

        const weekDays = eachUtcDate(start, weekEnd).map((day) => {
          const dayStart = parseUtcDate(day, now);
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          const meetings = upcomingMeetings.filter((item) =>
            inRange(item.startAt, dayStart, dayEnd),
          ).length;
          const deadlines = upcomingDeadlines.filter((item) =>
            inRange(item.dueDate, dayStart, dayEnd),
          ).length;
          return { day, meetings, deadlines };
        });

        return {
          date,
          hoursPerDay,
          totals: {
            myTasks: myTasksCount,
            completed: completedCount,
            overdue: overdueCount,
            upcomingMeetings: upcomingMeetingCount,
            total: myTasksCount,
            inProgress: inProgressCount,
          },
          myDay: {
            items: todayTasks.map((task) => {
              const people = task.assignees
                .map((item) => item.user)
                .filter(Boolean);
              const assignee =
                people[0] ?? task.owner ?? null;
              return {
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                startDate: task.startDate,
                estimatedHours:
                  task.estimatedMinutes == null
                    ? null
                    : hoursFromMinutes(task.estimatedMinutes),
                project: task.project,
                assignee,
                assignees: people,
              };
            }),
            total: todayTasks.length,
          },
          upcomingMeetings: {
            items: upcomingMeetings.map((meeting) => ({
              id: meeting.id,
              title: meeting.title,
              startAt: meeting.startAt,
              endAt: meeting.endAt,
              status: meeting.status,
              mode: meeting.mode,
              location: meeting.location,
              meetingLink: meeting.meetingLink,
              project: meeting.project,
              organizer: meeting.organizer,
              participants: [
                meeting.organizer,
                ...meeting.participants
                  .map((item) => item.user)
                  .filter((person) => person.id !== meeting.organizer.id),
              ],
            })),
            total: upcomingMeetingCount,
          },
          projectProgress: projectProgress.map((row) => ({
            projectId: row.projectId,
            name: row.name,
            completed: row.completed,
            open: row.open,
            percent: row.percent,
            status: row.status,
            dueDate: row.dueDate,
            members: row.members,
          })),
          activeProjects: projectProgress,
          teamWorkload: loadRows.slice(0, 6).map((row) => {
            const todayHours = hoursFromMinutes(row.todayMinutes);
            const overloaded = isOverloaded(row.todayMinutes, hoursPerDay);
            const weekDeadlines = row.weekDeadlineCount ?? 0;
            return {
              userId: row.userId,
              name: row.name,
              email: row.email,
              utilization: hoursPerDay
                ? roundHours(todayHours / hoursPerDay)
                : 0,
              overloaded,
              openTaskCount: row.openTaskCount,
              weekDeadlineCount: weekDeadlines,
              warning: overloaded
                ? {
                    title: 'High workload',
                    message: `This user has ${row.openTaskCount} active tasks and ${weekDeadlines} deadlines this week.`,
                  }
                : null,
            };
          }),
          recentActivity: activity,
          upcomingDeadlines,
          calendarPreview: {
            events: calendarEvents,
            week: weekDays,
          },
        };
      },
    );
  }

  private hoursPerDay(): number {
    return this.config.get<number>('workloadHoursPerDay') ?? 8;
  }

  private resolveDay(dateStr: string | undefined, now: Date) {
    const day = parseUtcDate(dateStr, now);
    const { start, end } = utcDayRange(day);
    return { start, end, date: start.toISOString().slice(0, 10) };
  }

  private toInsightTask(task: InsightTaskRecord) {
    const people = (task.assignees ?? [])
      .map((item) => item.user)
      .filter(Boolean);
    const assignee = people[0] ?? task.owner ?? null;
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      startDate: task.startDate,
      scheduledStart: task.scheduledStart,
      estimatedHours:
        task.estimatedMinutes == null
          ? null
          : hoursFromMinutes(task.estimatedMinutes),
      project: task.project,
      updatedAt: task.updatedAt,
      assignee,
      assignees: people,
    };
  }

  private section(items: InsightTaskRecord[], total: number) {
    return {
      items: items.map((task) => this.toInsightTask(task)),
      total,
    };
  }

  private reportTaskWhere(
    workspaceId: string,
    query: ReportsQueryDto,
  ): Prisma.TaskWhereInput {
    return {
      workspaceId,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.teamId ? { project: { teamId: query.teamId } } : {}),
      ...(query.userId
        ? {
            OR: [
              { ownerId: query.userId },
              { assignees: { some: { userId: query.userId } } },
            ],
          }
        : {}),
    };
  }

  private async loadWorkloadRows(
    workspaceId: string,
    start: Date,
    end: Date,
  ): Promise<WorkloadRow[]> {
    const week = utcWeekRange(start);
    return this.prisma.$queryRaw<WorkloadRow[]>(Prisma.sql`
      SELECT
        u.id AS "userId",
        u.name AS name,
        u.email AS email,
        COALESCE(SUM(
          CASE
            WHEN t.status NOT IN ('COMPLETED', 'ARCHIVED')
              AND (
                (t."dueDate" >= ${start} AND t."dueDate" < ${end})
                OR (t."startDate" >= ${start} AND t."startDate" < ${end})
                OR (t."scheduledStart" >= ${start} AND t."scheduledStart" < ${end})
                OR t.status = 'IN_PROGRESS'
              )
            THEN ROUND(
              COALESCE(t."estimatedMinutes", 60) * CASE t.priority
                WHEN 'LOW' THEN 0.75
                WHEN 'HIGH' THEN 1.35
                WHEN 'URGENT' THEN 1.7
                ELSE 1
              END
            )
            ELSE 0
          END
        ), 0)::int AS "todayMinutes",
        COALESCE(SUM(
          CASE
            WHEN t.status NOT IN ('COMPLETED', 'ARCHIVED')
            THEN ROUND(
              COALESCE(t."estimatedMinutes", 60) * CASE t.priority
                WHEN 'LOW' THEN 0.75
                WHEN 'HIGH' THEN 1.35
                WHEN 'URGENT' THEN 1.7
                ELSE 1
              END
            )
            ELSE 0
          END
        ), 0)::int AS "openMinutes",
        COUNT(*) FILTER (
          WHERE t.status NOT IN ('COMPLETED', 'ARCHIVED')
            AND t."estimatedMinutes" IS NULL
        )::int AS "unestimatedCount",
        COUNT(*) FILTER (
          WHERE t.status NOT IN ('COMPLETED', 'ARCHIVED')
        )::int AS "openTaskCount",
        COUNT(*) FILTER (
          WHERE t.status NOT IN ('COMPLETED', 'ARCHIVED')
            AND t."dueDate" >= ${week.start}
            AND t."dueDate" < ${week.end}
        )::int AS "weekDeadlineCount",
        COUNT(*) OVER()::int AS total
      FROM workspace_members wm
      JOIN users u ON u.id = wm."userId"
      LEFT JOIN task_assignees ta ON ta."userId" = wm."userId"
      LEFT JOIN tasks t ON t.id = ta."taskId" AND t."workspaceId" = wm."workspaceId"
      WHERE wm."workspaceId" = ${workspaceId}
        AND wm.status = CAST(${WorkspaceMemberStatus.ACTIVE} AS "WorkspaceMemberStatus")
      GROUP BY u.id, u.name, u.email
      ORDER BY "todayMinutes" DESC, u.name ASC
    `);
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = await this.redis.get(key);
    if (hit) {
      return JSON.parse(hit) as T;
    }
    const value = await load();
    await this.redis.set(key, JSON.stringify(value), CACHE_TTL_SECONDS);
    return value;
  }
}
