"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, PageHeader, PageShell, SectionTitle, Surface } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Meter, PageControls, StatCard, workloadGlyph } from "@/features/insights/ui";
import { useReports } from "@/features/insights/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useTeams } from "@/features/collaboration/hooks";
import { useWorkspaceMembers } from "@/features/workspaces/hooks";
import { localDateYmd, nativeSelectClass } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { AiNarrativeCard } from "@/features/ai/ui";

export default function ReportsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const defaultTo = localDateYmd();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 13);
  const defaultFrom = localDateYmd(fromDate);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [projectId, setProjectId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const projects = useProjects(workspaceId);
  const teams = useTeams(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const reports = useReports(workspaceId, {
    from,
    to,
    page,
    pageSize,
    projectId: projectId || undefined,
    teamId: teamId || undefined,
    userId: userId || undefined,
  });
  const total = reports.data?.projectPerformance.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const maxTrend = Math.max(
    1,
    ...(reports.data?.trends ?? []).flatMap((row) => [row.created, row.completed]),
  );
  const byPriority = reports.data?.completion.byPriority ?? {};
  const byStatus = reports.data?.completion.byStatus ?? {};

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description="Project and team metrics from live workspace data."
      />

      <Surface>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <input
              type="date"
              className={nativeSelectClass}
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <input
              type="date"
              className={nativeSelectClass}
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Project</span>
            <select
              className={nativeSelectClass}
              value={projectId}
              onChange={(event) => {
                setPage(1);
                setProjectId(event.target.value);
              }}
            >
              <option value="">All projects</option>
              {(projects.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Team</span>
            <select
              className={nativeSelectClass}
              value={teamId}
              onChange={(event) => {
                setPage(1);
                setTeamId(event.target.value);
              }}
            >
              <option value="">All teams</option>
              {(teams.data ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">User</span>
            <select
              className={nativeSelectClass}
              value={userId}
              onChange={(event) => {
                setPage(1);
                setUserId(event.target.value);
              }}
            >
              <option value="">All members</option>
              {(members.data ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Surface>

      {reports.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : reports.isError ? (
        <p className="text-sm text-destructive">{reports.error.message}</p>
      ) : !reports.data ? (
        <EmptyState title="Unable to load reports" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Completion rate"
              value={`${Math.round(reports.data.completion.completionRate * 100)}%`}
              hint={`${reports.data.completion.completed} completed · ${reports.data.completion.open} open`}
            />
            <StatCard label="Overdue" value={reports.data.overdue.count} />
            <StatCard
              label="Created"
              value={reports.data.completion.created ?? 0}
            />
            <StatCard
              label="Meetings"
              value={reports.data.meetings?.count ?? 0}
            />
          </div>

          <AiNarrativeCard from={from} to={to} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Surface>
              <SectionTitle>Tasks by status</SectionTitle>
              <div className="mt-3 space-y-2 text-sm">
                {Object.entries(byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span>{status.replaceAll("_", " ")}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </Surface>
            <Surface>
              <SectionTitle>Tasks by priority</SectionTitle>
              <div className="mt-3 space-y-2 text-sm">
                {Object.keys(byPriority).length === 0 ? (
                  <p className="text-muted-foreground">No priority data.</p>
                ) : (
                  Object.entries(byPriority).map(([priority, count]) => (
                    <div key={priority} className="flex justify-between">
                      <span>{priority}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </Surface>
          </div>

          <Surface>
            <SectionTitle>Team workload</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {reports.data.workload.overloadedCount} overloaded ·{" "}
              {reports.data.workload.todayHours}h today /{" "}
              {reports.data.workload.capacityHours}h capacity
            </p>
            <div className="mt-4 space-y-3">
              {(reports.data.workload.users ?? []).map((user) => {
                const percent = Math.min(100, Math.round(user.utilization * 100));
                return (
                  <div key={user.userId}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{user.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {workloadGlyph(percent)} {percent}%
                      </span>
                    </div>
                    <Meter value={percent} danger={user.overloaded} />
                  </div>
                );
              })}
            </div>
          </Surface>

          <Surface>
            <SectionTitle>Trends</SectionTitle>
            <div className="mt-4 flex h-28 items-end gap-1.5 overflow-x-auto">
              {reports.data.trends.map((row) => (
                <div key={row.day} className="flex w-4 shrink-0 flex-col justify-end gap-1">
                  <div
                    className="rounded-sm bg-primary"
                    style={{ height: `${Math.max(4, (row.completed / maxTrend) * 80)}px` }}
                    title={`${row.day}: ${row.completed} completed`}
                  />
                  <div
                    className="rounded-sm bg-sidebar"
                    style={{ height: `${Math.max(4, (row.created / maxTrend) * 80)}px` }}
                    title={`${row.day}: ${row.created} created`}
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Purple bars are completions; lavender bars are created tasks.
            </p>
          </Surface>

          <section className="space-y-3">
            <SectionTitle>Project progress</SectionTitle>
            {reports.data.projectPerformance.items.length === 0 ? (
              <EmptyState title="No project data in this range" />
            ) : (
              <div className="space-y-3">
                {reports.data.projectPerformance.items.map((project) => (
                  <Surface key={project.projectId ?? "none"}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        {project.projectId ? (
                          <Link
                            href={`/app/projects/${project.projectId}`}
                            className="font-medium hover:text-primary"
                          >
                            {project.name}
                          </Link>
                        ) : (
                          <p className="font-medium">{project.name}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {project.completed} completed · {project.open} open ·{" "}
                          {project.overdue} overdue
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {Math.round(project.completionRate * 100)}%
                      </p>
                    </div>
                    <Meter
                      className="mt-3"
                      value={Math.round(project.completionRate * 100)}
                    />
                  </Surface>
                ))}
              </div>
            )}
            <PageControls
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </section>
        </>
      )}
    </PageShell>
  );
}
