import { apiRequest } from "@/lib/api-client";
import type {
  CreateProjectInput,
  Project,
  ProjectMilestone,
  ProjectTemplate,
  ProjectTimeline,
  UpdateProjectInput,
} from "@/features/projects/types";

export function listProjects(includeArchived = false) {
  const search = includeArchived ? "?includeArchived=true" : "";
  return apiRequest<Project[]>(`/projects${search}`);
}

export function getProject(projectId: string) {
  return apiRequest<Project>(`/projects/${projectId}`);
}

export function createProject(input: CreateProjectInput) {
  return apiRequest<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProject(projectId: string, input: UpdateProjectInput) {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function archiveProject(projectId: string) {
  return apiRequest<Project>(`/projects/${projectId}/archive`, {
    method: "POST",
  });
}

export function deleteProject(projectId: string) {
  return apiRequest<void>(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export function listProjectTemplates() {
  return apiRequest<ProjectTemplate[]>("/projects/templates");
}

export function createProjectFromTemplate(input: {
  templateId: string;
  name?: string;
}) {
  return apiRequest<Project>("/projects/from-template", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function saveProjectAsTemplate(projectId: string, name?: string) {
  return apiRequest<{ id: string; name: string; builtin: boolean }>(
    `/projects/${projectId}/save-template`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
}

export function getProjectTimeline(projectId: string) {
  return apiRequest<ProjectTimeline>(`/projects/${projectId}/timeline`);
}

export function listProjectMilestones(projectId: string) {
  return apiRequest<ProjectMilestone[]>(`/projects/${projectId}/milestones`);
}

export function createProjectMilestone(
  projectId: string,
  input: { title: string; description?: string; dueDate?: string },
) {
  return apiRequest<ProjectMilestone>(`/projects/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  input: { title: string; description?: string; dueDate?: string },
) {
  return apiRequest<ProjectMilestone>(
    `/projects/${projectId}/milestones/${milestoneId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteProjectMilestone(projectId: string, milestoneId: string) {
  return apiRequest<{ ok: boolean }>(
    `/projects/${projectId}/milestones/${milestoneId}`,
    { method: "DELETE" },
  );
}
