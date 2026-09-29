"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/features/projects/project-hub";
import {
  useCreateFromTemplate,
  useProjectTemplates,
  useProjects,
} from "@/features/projects/hooks";
import { useTeams } from "@/features/collaboration/hooks";
import {
  PRIORITIES,
  PROJECT_STATUSES,
  type Priority,
  type ProjectStatus,
} from "@/features/projects/types";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { cn, nativeSelectClass } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default function ProjectsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [teamId, setTeamId] = useState("");
  const includeArchived = status === "ARCHIVED";
  const projects = useProjects(workspaceId, includeArchived);
  const teams = useTeams(workspaceId);
  const templates = useProjectTemplates(workspaceId);
  const createFromTemplate = useCreateFromTemplate();
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const canWrite = workspace && workspace.role !== "VIEWER";
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects.data ?? []).filter((project) => {
      if (status && project.status !== status) return false;
      if (priority && project.priority !== priority) return false;
      if (teamId && project.teamId !== teamId) return false;
      if (!q) return true;
      const haystack = [
        project.name,
        project.description ?? "",
        project.owner?.name ?? "",
        project.team?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [projects.data, query, status, priority, teamId]);

  const hasFilters = Boolean(query.trim() || status || priority || teamId);
  const total = projects.data?.length ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        description="Work grouped by initiative."
        actions={
          canWrite ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplateOpen((value) => !value)}
              >
                From template
              </Button>
              <Button size="sm" onClick={() => setOpenCreateDialog("project")}>
                New project
              </Button>
            </>
          ) : null
        }
      />
      {canWrite && templateOpen ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!templateId) return;
            void createFromTemplate
              .mutateAsync({
                templateId,
                name: templateName.trim() || undefined,
              })
              .then(() => {
                setTemplateName("");
              });
          }}
        >
          <select
            className={nativeSelectClass}
            aria-label="Template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Choose a template</option>
            {(templates.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.builtin ? " (built-in)" : ""}
              </option>
            ))}
          </select>
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Project name (optional)"
          />
          <Button
            type="submit"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            disabled={!templateId || createFromTemplate.isPending}
          >
            {createFromTemplate.isPending ? "Creating…" : "Create"}
          </Button>
        </form>
      ) : null}
      {createFromTemplate.error ? (
        <p className="text-sm text-destructive">
          {createFromTemplate.error.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 lg:max-w-xs lg:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="h-8 pl-8"
            aria-label="Search projects"
          />
        </div>
        <select
          className={cn(nativeSelectClass, "h-8 lg:max-w-[160px]")}
          aria-label="Status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as ProjectStatus | "")
          }
        >
          <option value="">Any status</option>
          {PROJECT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>
        <select
          className={cn(nativeSelectClass, "h-8 lg:max-w-[140px]")}
          aria-label="Priority"
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value as Priority | "")
          }
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>
        <select
          className={cn(nativeSelectClass, "h-8 lg:max-w-[180px]")}
          aria-label="Team"
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
        >
          <option value="">Any team</option>
          {(teams.data ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        {hasFilters ? (
          <button
            type="button"
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground lg:ml-auto"
            onClick={() => {
              setQuery("");
              setStatus("");
              setPriority("");
              setTeamId("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {projects.isLoading ? (
        <Skeleton className="h-36 w-full" />
      ) : projects.isError ? (
        <p className="text-sm text-destructive">{projects.error.message}</p>
      ) : total === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to group tasks and meetings."
          action={
            canWrite ? (
              <Button size="sm" onClick={() => setOpenCreateDialog("project")}>
                New project
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching projects"
          description="Try another search or clear the filters."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setQuery("");
                setStatus("");
                setPriority("");
                setTeamId("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <ListPanel className="divide-y divide-border">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ListPanel>
          <p className="text-[12px] text-muted-foreground">
            {filtered.length}
            {filtered.length !== total ? ` of ${total}` : ""}{" "}
            {filtered.length === 1 ? "project" : "projects"}
          </p>
        </>
      )}
    </PageShell>
  );
}
