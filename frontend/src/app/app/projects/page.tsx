"use client";

import { useMemo, useState } from "react";
import {
  FolderKanban,
  LayoutGrid,
  LayoutTemplate,
  List,
  Plus,
  Search,
  SearchX,
  X,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  SegmentedControl,
  Surface,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SkeletonCards, SkeletonList } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ProjectCard, ProjectRow } from "@/features/projects/project-hub";
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

function optionLabel(value: string) {
  const label = value.replaceAll("_", " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type ViewMode = "grid" | "list";

export default function ProjectsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [teamId, setTeamId] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
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

  function clearFilters() {
    setQuery("");
    setStatus("");
    setPriority("");
    setTeamId("");
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title="Projects"
        icon={FolderKanban}
        description="Work grouped by initiative."
        actions={
          canWrite ? (
            <>
              <Button
                variant="outline"
                size="sm"
                aria-expanded={templateOpen}
                onClick={() => setTemplateOpen((value) => !value)}
              >
                <LayoutTemplate />
                From template
              </Button>
              <Button size="sm" onClick={() => setOpenCreateDialog("project")}>
                <Plus />
                New project
              </Button>
            </>
          ) : null
        }
      />
      {canWrite && templateOpen ? (
        <Surface className="animate-slide-up">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-medium text-foreground">
                Start from a template
              </p>
              <p className="text-sm text-muted-foreground">
                Milestones and tasks are copied into a new project.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close template picker"
              onClick={() => setTemplateOpen(false)}
            >
              <X />
            </Button>
          </div>
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
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
                  toast.success("Project created from template");
                })
                .catch(() => undefined);
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
              aria-label="Project name"
            />
            <Button
              type="submit"
              disabled={!templateId}
              loading={createFromTemplate.isPending}
            >
              Create
            </Button>
          </form>
          {createFromTemplate.error ? (
            <p className="mt-2 text-sm text-danger-soft-foreground">
              {createFromTemplate.error.message}
            </p>
          ) : null}
        </Surface>
      ) : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 lg:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="h-8 pl-8"
            aria-label="Search projects"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center">
          <select
            className={cn(nativeSelectClass, "h-8 min-w-0 lg:w-36")}
            aria-label="Status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ProjectStatus | "")
            }
          >
            <option value="">Any status</option>
            {PROJECT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {optionLabel(item)}
              </option>
            ))}
          </select>
          <select
            className={cn(nativeSelectClass, "h-8 min-w-0 lg:w-36")}
            aria-label="Priority"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as Priority | "")
            }
          >
            <option value="">Any priority</option>
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {optionLabel(item)}
              </option>
            ))}
          </select>
          <select
            className={cn(nativeSelectClass, "h-8 min-w-0 lg:w-40")}
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
        </div>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start lg:self-auto"
            onClick={clearFilters}
          >
            <X />
            Clear
          </Button>
        ) : null}
        <SegmentedControl
          className="hidden sm:inline-flex lg:ml-auto"
          label="Layout"
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: "Grid", icon: <LayoutGrid /> },
            { value: "list", label: "List", icon: <List /> },
          ]}
        />
      </div>

      {projects.isLoading ? (
        view === "grid" ? (
          <SkeletonCards count={6} className="sm:grid-cols-2 lg:grid-cols-3" />
        ) : (
          <ListPanel>
            <SkeletonList rows={6} />
          </ListPanel>
        )
      ) : projects.isError ? (
        <ErrorState
          title="Couldn't load projects"
          description={projects.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void projects.refetch()}>
              Retry
            </Button>
          }
        />
      ) : total === 0 ? (
        <Surface className="p-0 sm:p-0">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project to group tasks and meetings."
            action={
              canWrite ? (
                <Button size="sm" onClick={() => setOpenCreateDialog("project")}>
                  <Plus />
                  New project
                </Button>
              ) : undefined
            }
          />
        </Surface>
      ) : filtered.length === 0 ? (
        <Surface className="p-0 sm:p-0">
          <EmptyState
            icon={SearchX}
            title="No matching projects"
            description="Try another search or clear the filters."
            action={
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </Surface>
      ) : (
        <>
          {view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:hidden">
                {filtered.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              <ListPanel className="hidden divide-y divide-border sm:block">
                {filtered.map((project) => (
                  <ProjectRow key={project.id} project={project} />
                ))}
              </ListPanel>
            </>
          )}
          <p className="text-xs text-muted-foreground tabular">
            {filtered.length}
            {filtered.length !== total ? ` of ${total}` : ""}{" "}
            {filtered.length === 1 ? "project" : "projects"}
          </p>
        </>
      )}
    </PageShell>
  );
}
