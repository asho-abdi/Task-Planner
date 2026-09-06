"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { MemberAvatarGroup } from "@/components/member-avatar-group";
import type { Project } from "@/features/projects/types";
import { cn } from "@/lib/utils";

export const PROJECT_TABS = [
  "overview",
  "tasks",
  "board",
  "timeline",
  "milestones",
  "calendar",
  "files",
  "meetings",
  "chat",
  "notes",
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

export function ProjectCard({ project }: { project: Project }) {
  const people = project.members?.map((item) => item.user) ?? [project.owner];
  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-semibold">
            {project.icon || project.name.slice(0, 1).toUpperCase()}
          </span>
          <h2 className="truncate text-base font-semibold tracking-tight">
            {project.name}
          </h2>
        </div>
        <StatusBadge value={project.status} />
      </div>
      {project.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{project._count.tasks} tasks</span>
        <MemberAvatarGroup people={people} />
      </div>
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
  const people = project.members?.map((item) => item.user) ?? [project.owner];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-lg font-semibold">
            {project.icon || project.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge value={project.status} />
              <span>
                {project.progress?.percent ?? 0}% complete
              </span>
              <span>Owner {project.owner.name}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MemberAvatarGroup people={people} />
          {actions}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${project.progress?.percent ?? 0}%` }}
        />
      </div>
    </div>
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
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
      {PROJECT_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm capitalize whitespace-nowrap",
            value === tab
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
