"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard, useMyDay, useReports } from "@/features/insights/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import { useStartTask } from "@/features/tasks/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { cn, formatDate, localDateYmd } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DashboardTask, InsightTask } from "@/features/insights/types";

const STATUS_TONES: Record<string, string> = {
  COMPLETED: "#16A34A",
  IN_PROGRESS: "#635BFF",
  OVERDUE: "#EF4444",
  TODO: "#94A3B8",
  IN_REVIEW: "#F59E0B",
  RETURNED: "#EF4444",
};

function firstNameOf(name?: string | null) {
  return name?.split(" ")[0] ?? "there";
}

function shiftYmd(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateYmd(date);
}

function weekday(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function canStartTask(status: string) {
  return status === "TODO" || status === "RETURNED" || status === "OVERDUE";
}

function changeFromTrend(
  values: number[],
): { percent: number; up: boolean } | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const previous = values.slice(0, mid).reduce((sum, n) => sum + n, 0);
  const current = values.slice(mid).reduce((sum, n) => sum + n, 0);
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { percent: 100, up: true };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return null;
  return { percent: Math.abs(percent), up: percent > 0 };
}

export function DashboardHome() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const user = useCurrentUser();
  const workspace = useCurrentWorkspace();
  const dashboard = useDashboard(workspaceId);
  const myDay = useMyDay(workspaceId, localDateYmd());
  const [range, setRange] = useState<"7" | "14">("7");
  const to = localDateYmd();
  const from = shiftYmd(to, 1 - Number(range));
  const reports = useReports(workspaceId, { from, to });
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const openMeetingCreate = useUiStore((state) => state.openMeetingCreate);
  const firstName = firstNameOf(user.data?.name);
  const canWrite = Boolean(workspace && workspace.role !== "VIEWER");
  const data = dashboard.data;
  const todayTasks = myDay.data?.todayTasks.items ?? data?.myDay?.items ?? [];

  const myTasks = data?.totals.myTasks ?? data?.totals.total ?? 0;
  const completed = data?.totals.completed ?? 0;
  const overdue = data?.totals.overdue ?? 0;
  const meetings =
    data?.totals.upcomingMeetings ?? data?.upcomingMeetings.total ?? 0;
  const createdTrend = reports.data?.trends.map((item) => item.created) ?? [];
  const completedTrend =
    reports.data?.trends.map((item) => item.completed) ?? [];
  const weekCreated = createdTrend.reduce((sum, n) => sum + n, 0);
  const weekCompleted = completedTrend.reduce((sum, n) => sum + n, 0);

  const donut = useMemo(() => {
    const byStatus = reports.data?.completion.byStatus ?? {};
    const rows = Object.entries(byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        label: status.replaceAll("_", " ").toLowerCase(),
        count,
        color: STATUS_TONES[status] ?? "#94A3B8",
      }));
    if (rows.length) return rows;
    return [
      { label: "open", count: myTasks, color: "#635BFF" },
      { label: "completed", count: completed, color: "#16A34A" },
      { label: "overdue", count: overdue, color: "#EF4444" },
    ].filter((item) => item.count > 0);
  }, [reports.data?.completion.byStatus, myTasks, completed, overdue]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#172033] sm:text-[30px]">
            Dashboard
          </h1>
          <label className="sr-only" htmlFor="dashboard-range">
            Date range
          </label>
          <select
            id="dashboard-range"
            value={range}
            onChange={(event) => setRange(event.target.value as "7" | "14")}
            className="h-9 rounded-xl border border-[#E5E7EB] bg-white px-3 text-[14px] font-medium text-[#172033] shadow-[var(--shadow-soft)]"
          >
            <option value="7">This week</option>
            <option value="14">Last 14 days</option>
          </select>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openTaskCreate()}>
              Create Task
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openMeetingCreate()}
            >
              Schedule Meeting
            </Button>
          </div>
        ) : null}
      </header>
      <p className="text-sm text-[#64748B]">
        Welcome back, {firstName}.
      </p>

      {dashboard.isError ? (
        <p className="text-sm text-destructive">{dashboard.error.message}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-5">
          {dashboard.isLoading ? (
            <>
              <Skeleton className="h-[118px] rounded-2xl" />
              <Skeleton className="h-[118px] rounded-2xl" />
              <Skeleton className="h-[118px] rounded-2xl" />
              <Skeleton className="h-[118px] rounded-2xl" />
            </>
          ) : (
            <>
              <StatCard
                href="/app/tasks"
                label="My Tasks"
                value={myTasks}
                hint="Open work assigned to you"
                icon={CheckSquare}
                change={changeFromTrend(createdTrend)}
              />
              <StatCard
                href="/app/tasks"
                label="Completed"
                value={completed}
                hint="Finished in this workspace"
                icon={CheckCircle2}
                tone="success"
                change={changeFromTrend(completedTrend)}
              />
              <StatCard
                href="/app/my-day"
                label="Overdue"
                value={overdue}
                hint="Needs attention"
                icon={AlertTriangle}
                tone="danger"
              />
              <StatCard
                href="/app/meetings"
                label="Upcoming Meetings"
                value={meetings}
                hint="Scheduled this week"
                icon={CalendarDays}
              />
            </>
          )}
        </div>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[var(--shadow-soft)] xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#172033]">Activity</h2>
              <p className="text-xs text-[#64748B]">
                Tasks created and completed
              </p>
            </div>
            <div className="flex gap-5 text-sm">
              <Legend swatch="#635BFF" label={`${weekCreated} created`} />
              <Legend swatch="#16A34A" label={`${weekCompleted} completed`} />
            </div>
          </div>
          {reports.isLoading ? (
            <Skeleton className="mt-6 h-52" />
          ) : reports.isError ? (
            <p className="mt-8 text-sm text-destructive">
              {reports.error.message}
            </p>
          ) : !(reports.data?.trends.length ?? 0) ? (
            <p className="mt-16 text-center text-sm text-[#64748B]">
              No activity in this range yet.
            </p>
          ) : (
            <TrendChart
              labels={(reports.data?.trends ?? []).map((item) =>
                weekday(item.day),
              )}
              created={createdTrend}
              completed={completedTrend}
            />
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[var(--shadow-soft)] xl:col-span-8">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#172033]">
              Today&apos;s tasks
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/my-day">View all</Link>
            </Button>
          </div>
          {dashboard.isLoading && myDay.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : todayTasks.length === 0 ? (
            <p className="px-5 py-10 text-sm text-[#64748B]">
              No tasks assigned yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[14px] font-medium">
                <thead className="text-[12px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="px-5 py-3 font-medium">Task</th>
                    <th className="px-3 py-3 font-medium">Project</th>
                    <th className="px-3 py-3 font-medium">Priority</th>
                    <th className="px-3 py-3 font-medium">Due</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayTasks.slice(0, 8).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      canWrite={canWrite}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[var(--shadow-soft)] xl:col-span-4">
          <h2 className="text-[15px] font-bold text-[#172033]">Work mix</h2>
          <p className="text-xs text-[#64748B]">By status in this range</p>
          {reports.isLoading && dashboard.isLoading ? (
            <Skeleton className="mx-auto mt-8 h-44 w-44 rounded-full" />
          ) : donut.length === 0 ? (
            <p className="mt-16 text-center text-sm text-[#64748B]">
              No work to chart yet.
            </p>
          ) : (
            <>
              <Donut
                total={donut.reduce((sum, item) => sum + item.count, 0)}
                slices={donut}
              />
              <ul className="mt-4 space-y-2">
                {donut.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2 capitalize text-[#64748B]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: item.color }}
                      />
                      {item.label}
                    </span>
                    <span className="font-medium text-[#172033]">
                      {item.count}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  tone,
  change,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: typeof CheckSquare;
  tone?: "success" | "danger";
  change?: { percent: number; up: boolean } | null;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[#64748B]">{label}</p>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            tone === "success" && "bg-emerald-50 text-[#16A34A]",
            tone === "danger" && "bg-red-50 text-[#EF4444]",
            !tone && "bg-[#EEF2FF] text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-[28px] font-semibold tracking-tight text-[#172033]",
          tone === "danger" && value > 0 && "text-[#EF4444]",
        )}
      >
        {value.toLocaleString()}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {change ? (
          <span
            className={cn(
              "inline-flex items-center font-medium",
              change.up ? "text-[#16A34A]" : "text-[#EF4444]",
            )}
          >
            {change.up ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {change.percent}%
          </span>
        ) : null}
        <span className="text-[#64748B]">{hint}</span>
      </div>
    </Link>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#64748B]">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: swatch }}
      />
      {label}
    </span>
  );
}

function TaskRow({
  task,
  canWrite,
}: {
  task: InsightTask | DashboardTask;
  canWrite: boolean;
}) {
  const start = useStartTask();
  const canStart = canWrite && canStartTask(task.status);

  return (
    <tr className="border-b border-[#E5E7EB] last:border-0">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label={canStart ? "Start work" : "Task status"}
            disabled={!canStart || start.isPending}
            onClick={() => {
              if (canStart) void start.mutateAsync(task.id);
            }}
            className={cn(
              "h-4 w-4 shrink-0 rounded border",
              canStart
                ? "border-[#CBD5E1] bg-white hover:border-primary"
                : "border-primary bg-primary/10",
            )}
          />
          <Link
            href={`/app/tasks/${task.id}`}
            className="font-medium text-[#172033] hover:text-primary"
          >
            {task.title}
          </Link>
        </div>
      </td>
      <td className="px-3 py-3.5 text-[#64748B]">
        {task.project?.name ?? "—"}
      </td>
      <td className="px-3 py-3.5">
        <StatusBadge value={task.priority} />
      </td>
      <td className="px-3 py-3.5 text-[#64748B]">
        {task.dueDate ? formatDate(task.dueDate) : "—"}
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge value={task.status} />
      </td>
    </tr>
  );
}

function TrendChart({
  labels,
  created,
  completed,
}: {
  labels: string[];
  created: number[];
  completed: number[];
}) {
  const width = 640;
  const height = 220;
  const pad = { l: 28, r: 12, t: 16, b: 28 };
  const max = Math.max(1, ...created, ...completed);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (index: number) =>
    pad.l + (labels.length <= 1 ? innerW / 2 : (index / (labels.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / max) * innerH;
  const path = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-52 w-full">
      {[0.25, 0.5, 0.75, 1].map((tick) => (
        <line
          key={tick}
          x1={pad.l}
          x2={width - pad.r}
          y1={y(max * tick)}
          y2={y(max * tick)}
          stroke="#E5E7EB"
          strokeDasharray="4 6"
        />
      ))}
      <path d={path(created)} fill="none" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round" />
      <path d={path(completed)} fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" />
      {created.map((value, index) => (
        <circle key={`c-${index}`} cx={x(index)} cy={y(value)} r="3" fill="#635BFF">
          <title>{`${labels[index]} · ${value} created`}</title>
        </circle>
      ))}
      {completed.map((value, index) => (
        <circle key={`d-${index}`} cx={x(index)} cy={y(value)} r="3" fill="#16A34A">
          <title>{`${labels[index]} · ${value} completed`}</title>
        </circle>
      ))}
      {labels.map((label, index) => (
        <text
          key={label + index}
          x={x(index)}
          y={height - 8}
          textAnchor="middle"
          className="fill-[#94A3B8] text-[11px]"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function Donut({
  total,
  slices,
}: {
  total: number;
  slices: Array<{ label: string; count: number; color: string }>;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto mt-6 h-44 w-44">
      <svg viewBox="0 0 140 140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#EEF2F6"
          strokeWidth="16"
        />
        {slices.map((slice) => {
          const len = total ? (slice.count / total) * c : 0;
          const circle = (
            <circle
              key={slice.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += len;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs text-[#64748B]">Total</p>
        <p className="text-xl font-semibold text-[#172033]">
          {total.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
