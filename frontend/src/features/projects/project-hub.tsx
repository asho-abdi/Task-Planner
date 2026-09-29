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
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[11px] font-semibold text-primary">
        {project.icon || project.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[13px] font-medium text-foreground">
            {project.name}
          </h2>
          <StatusBadge value={project.status} />
        </div>
        {project.description ? (
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </div>
      <p className="hidden shrink-0 text-[12px] text-muted-foreground sm:block">
        {project._count.tasks} tasks
      </p>
      <MemberAvatarGroup people={people} />
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
            <h1 className="font-heading text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] sm:text-[30px]">
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
