"use client";

import { useState } from "react";
import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/features/projects/project-hub";
import {
  useCreateFromTemplate,
  useProjectTemplates,
  useProjects,
} from "@/features/projects/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { nativeSelectClass } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function ProjectsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const projects = useProjects(workspaceId);
  const templates = useProjectTemplates(workspaceId);
  const createFromTemplate = useCreateFromTemplate();
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const canWrite = workspace && workspace.role !== "VIEWER";
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        description="Workspace-scoped projects. Archive before deleting."
        actions={
          canWrite ? (
            <Button onClick={() => setOpenCreateDialog("project")}>
              New project
            </Button>
          ) : null
        }
      />
      {canWrite ? (
        <Surface>
          <h2 className="text-base font-semibold">Create from Template</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Software Development, Marketing Campaign, Product Launch, Event
            Planning, and HR Recruitment, plus saved workspace templates.
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
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
            <div className="space-y-1">
              <Label htmlFor="template">Template</Label>
              <select
                id="template"
                className={nativeSelectClass}
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
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-name">Project name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button
              className="self-end"
              type="submit"
              disabled={!templateId || createFromTemplate.isPending}
            >
              {createFromTemplate.isPending ? "Creating…" : "Create"}
            </Button>
          </form>
          {createFromTemplate.error ? (
            <p className="mt-2 text-sm text-destructive">
              {createFromTemplate.error.message}
            </p>
          ) : null}
        </Surface>
      ) : null}
      {projects.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : projects.isError ? (
        <p className="text-sm text-destructive">{projects.error.message}</p>
      ) : (projects.data ?? []).length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to group tasks and meetings."
          action={
            canWrite ? (
              <Button onClick={() => setOpenCreateDialog("project")}>
                New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(projects.data ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
