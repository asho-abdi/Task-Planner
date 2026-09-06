"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as projectsApi from "@/features/projects/api";
import type { UpdateProjectInput } from "@/features/projects/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export const projectKeys = {
  all: (workspaceId: string) => ["projects", workspaceId] as const,
  list: (workspaceId: string, includeArchived: boolean) =>
    [...projectKeys.all(workspaceId), "list", includeArchived] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.all(workspaceId), "detail", projectId] as const,
};

export function useProjects(
  workspaceId: string | null,
  includeArchived = false,
  enabled = true,
) {
  return useQuery({
    queryKey: projectKeys.list(workspaceId ?? "none", includeArchived),
    queryFn: () => projectsApi.listProjects(includeArchived),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 60_000,
  });
}

export function useProject(workspaceId: string | null, projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId ?? "none", projectId),
    queryFn: () => projectsApi.getProject(projectId),
    enabled: Boolean(workspaceId) && Boolean(projectId),
    staleTime: 60_000,
  });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  return () => {
    if (!workspaceId) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: projectKeys.all(workspaceId) });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: invalidate,
  });
}

export function useUpdateProject(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      projectsApi.updateProject(projectId, input),
    onSuccess: invalidate,
  });
}

export function useArchiveProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: projectsApi.archiveProject,
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: projectsApi.deleteProject,
    onSuccess: invalidate,
  });
}

export function useProjectTemplates(workspaceId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...projectKeys.all(workspaceId ?? "none"), "templates"],
    queryFn: projectsApi.listProjectTemplates,
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 60_000,
  });
}

export function useCreateFromTemplate() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: projectsApi.createProjectFromTemplate,
    onSuccess: invalidate,
  });
}

export function useSaveProjectTemplate(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (name?: string) =>
      projectsApi.saveProjectAsTemplate(projectId, name),
    onSuccess: invalidate,
  });
}

export function useProjectTimeline(
  workspaceId: string | null,
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [...projectKeys.detail(workspaceId ?? "none", projectId), "timeline"],
    queryFn: () => projectsApi.getProjectTimeline(projectId),
    enabled: Boolean(workspaceId) && Boolean(projectId) && enabled,
    staleTime: 30_000,
  });
}

export function useProjectMilestones(
  workspaceId: string | null,
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      ...projectKeys.detail(workspaceId ?? "none", projectId),
      "milestones",
    ],
    queryFn: () => projectsApi.listProjectMilestones(projectId),
    enabled: Boolean(workspaceId) && Boolean(projectId) && enabled,
    staleTime: 30_000,
  });
}

export function useCreateProjectMilestone(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      dueDate?: string;
    }) => projectsApi.createProjectMilestone(projectId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateProjectMilestone(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: {
      milestoneId: string;
      title: string;
      description?: string;
      dueDate?: string;
    }) =>
      projectsApi.updateProjectMilestone(projectId, input.milestoneId, {
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteProjectMilestone(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (milestoneId: string) =>
      projectsApi.deleteProjectMilestone(projectId, milestoneId),
    onSuccess: invalidate,
  });
}
