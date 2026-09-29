"use client";

import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Columns3,
  FileText,
  Folder,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Progress, progressTone } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Project } from "@/features/projects/types";
import { cn, formatDate } from "@/lib/utils";

export const PROJECT_TABS = [
  "overview",
  "tasks",
  "board",
  "calendar",
  "files",
  "meetings",
  "chat",
  "notes",
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

const TAB_META: Record<ProjectTab, { label: string; icon: LucideIcon }> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  tasks: { label: "Tasks", icon: CheckSquare },
  board: { label: "Board", icon: Columns3 },
  calendar: { label: "Calendar", icon: CalendarRange },
  files: { label: "Files", icon: FileText },
  meetings: { label: "Meetings", icon: Video },
  chat: { label: "Chat", icon: MessagesSquare },
  notes: { label: "Notes", icon: NotebookPen },
};

/** Due date shown for a project (explicit due date, else end date). */
export function projectDueDate(project: Project) {
  return project.dueDate ?? project.endDate ?? null;
}

export function isProjectOverdue(project: Project) {
  const due = projectDueDate(project);
  if (!due) return false;
  if (project.status === "COMPLETED" || project.status === "ARCHIVED") {
    return false;
  }
  const time = new Date(due).getTime();
  return Number.isFinite(time) && time < Date.now();
}

export function projectPeople(project: Project) {
  return project.members?.map((item) => item.user) ?? [project.owner];
}

export function projectProgress(project: Project) {
  return {
    percent: project.progress?.percent ?? 0,
    completed: project.progress?.completed ?? 0,
    total: project.progress?.total ?? project._count.tasks,
  };
}

/** Square tile with the project's emoji icon or initial. */
export function ProjectIconTile({
  project,
  size = "default",
  className,
}: {
  project: Pick<Project, "icon" | "name">;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border border-primary/15 bg-primary-soft font-semibold text-primary-soft-foreground",
        size === "sm" && "size-8 rounded-md text-sm",
        size === "default" && "size-10 rounded-lg text-md",
        size === "lg" && "size-14 rounded-xl text-2xl",
        className,
      )}
    >
      {project.icon || project.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function DueLabel({ project }: { project: Project }) {
  const due = projectDueDate(project);
  const overdue = isProjectOverdue(project);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular",
        overdue ? "text-danger-soft-foreground" : "text-muted-foreground",
      )}
      title={overdue ? "Overdue" : "Due date"}
    >
      <CalendarDays className="size-3.5" />
      {due ? formatDate(due) : "No due date"}
    </span>
  );
}

/** Grid card used on the projects list. */
export function ProjectCard({ project }: { project: Project }) {
  const people = projectPeople(project);
  const progress = projectProgress(project);
  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card interactive className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ProjectIconTile project={project} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-md font-semibold tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
              {project.name}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {project.team?.name ?? project.owner.name}
            </p>
          </div>
          <StatusBadge value={project.status} className="shrink-0" />
        </div>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {project.description || "No description yet."}
        </p>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular">
              {progress.completed} of {progress.total}{" "}
              {progress.total === 1 ? "task" : "tasks"}
            </span>
            <span className="font-medium text-foreground tabular">
              {progress.percent}%
            </span>
          </div>
          <Progress
            value={progress.percent}
            tone={progressTone(progress.percent)}
            aria-label={`${project.name} progress`}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <PriorityBadge value={project.priority} />
            <DueLabel project={project} />
          </div>
          <AvatarStack people={people} max={3} size="sm" />
        </div>
      </Card>
    </Link>
  );
}

/** Compact row used by the list view of the projects page. */
export function ProjectRow({ project }: { project: Project }) {
  const people = projectPeople(project);
  const progress = projectProgress(project);
  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
    >
      <ProjectIconTile project={project} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-medium text-foreground group-hover:text-primary">
            {project.name}
          </h2>
          <StatusBadge value={project.status} className="shrink-0" />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {project.description || (project.team?.name ?? project.owner.name)}
        </p>
      </div>
      <div className="hidden w-36 shrink-0 space-y-1 md:block">
        <div className="flex justify-between text-xs text-muted-foreground tabular">
          <span>
            {progress.completed}/{progress.total}
          </span>
          <span>{progress.percent}%</span>
        </div>
        <Progress
          value={progress.percent}
          tone={progressTone(progress.percent)}
          size="sm"
          aria-label={`${project.name} progress`}
        />
      </div>
      <div className="hidden w-20 shrink-0 lg:block">
        <PriorityBadge value={project.priority} />
      </div>
      <div className="hidden w-28 shrink-0 text-xs sm:block">
        <DueLabel project={project} />
      </div>
      <AvatarStack people={people} max={3} size="xs" className="shrink-0" />
    </Link>
  );
}

export function ProjectHeader({
  project,
  actions,
}: {
  project: Project;
  actions?: ReactNode;
}) {
  const people = projectPeople(project);
  const progress = projectProgress(project);
  const due = projectDueDate(project);
  const overdue = isProjectOverdue(project);
  return (
    <header className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/app/projects" },
          { label: project.name },
        ]}
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <ProjectIconTile project={project} size="lg" />
          <div className="min-w-0 space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={project.status} />
              <PriorityBadge value={project.priority} />
              {project.team ? (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Folder className="size-3.5" />
                  {project.team.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <Card className="grid grid-cols-2 gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr_1fr_1.6fr] lg:items-center">
        <div className="col-span-2 flex min-w-0 items-center gap-2.5 sm:col-span-1">
          <Avatar name={project.owner.name} size="sm" title={project.owner.name} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="truncate text-base font-medium text-foreground">
              {project.owner.name}
            </p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Timeline</p>
          <p className="text-base font-medium text-foreground tabular">
            <span className="whitespace-nowrap">{project.startDate ? formatDate(project.startDate) : "Not started"}</span>
            <span className="text-subtle-foreground"> → </span>
            <span className={cn("whitespace-nowrap", overdue && "text-danger-soft-foreground")}>
              {due ? formatDate(due) : "No due date"}
            </span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Members</p>
          <div className="mt-0.5 flex items-center gap-2">
            <AvatarStack people={people} max={5} size="sm" />
            <span className="text-sm text-muted-foreground tabular">
              {people.length}
            </span>
          </div>
        </div>
        <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Progress ·{" "}
              <span className="tabular">
                {progress.completed} of {progress.total} tasks
              </span>
            </p>
            <p className="font-heading text-lg font-semibold text-foreground tabular">
              {progress.percent}%
            </p>
          </div>
          <Progress
            value={progress.percent}
            tone={progressTone(progress.percent)}
            aria-label="Project progress"
          />
        </div>
      </Card>
    </header>
  );
}

export function ProjectTabs({
  value,
  onChange,
}: {
  value: ProjectTab;
  onChange: (tab: ProjectTab) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as ProjectTab)}>
      <TabsList variant="line" aria-label="Project sections">
        {PROJECT_TABS.map((tab) => {
          const meta = TAB_META[tab];
          const Icon = meta.icon;
          return (
            <TabsTrigger key={tab} value={tab}>
              <Icon />
              {meta.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
