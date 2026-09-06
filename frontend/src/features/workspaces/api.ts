import { apiRequest } from "@/lib/api-client";
import type {
  InvitationPreview,
  InviteResult,
  MyInvitation,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from "@/features/workspaces/types";

export function listWorkspaces() {
  return apiRequest<Workspace[]>("/workspaces");
}

export function createWorkspace(input: {
  name: string;
  description?: string;
  logo?: string;
}) {
  return apiRequest<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getWorkspace(workspaceId: string) {
  return apiRequest<Workspace>(`/workspaces/${workspaceId}`, { workspaceId });
}

export function updateWorkspace(
  workspaceId: string,
  input: { name?: string; description?: string; logo?: string },
) {
  return apiRequest<Workspace>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    workspaceId,
    body: JSON.stringify(input),
  });
}

export function listMembers(workspaceId: string) {
  return apiRequest<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`, {
    workspaceId,
  });
}

export function listInvitations(workspaceId: string) {
  return apiRequest<WorkspaceInvitation[]>(
    `/workspaces/${workspaceId}/invitations`,
    { workspaceId },
  );
}

export function inviteMember(
  workspaceId: string,
  input: { email: string; role: WorkspaceRole },
) {
  return apiRequest<InviteResult>(`/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    workspaceId,
    body: JSON.stringify(input),
  });
}

export function previewInvitation(token: string) {
  return apiRequest<InvitationPreview>(
    `/workspaces/invitations/preview/${token}`,
    { skipAuth: true },
  );
}

export function listMyInvitations() {
  return apiRequest<MyInvitation[]>("/workspaces/invitations/mine");
}

export function acceptInvitation(token: string) {
  return apiRequest<{ workspaceId: string }>("/workspaces/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function acceptMyInvitation(invitationId: string) {
  return apiRequest<{ workspaceId: string }>(
    `/workspaces/invitations/accept/${invitationId}`,
    { method: "POST" },
  );
}

export function declineInvitation(input: {
  token?: string;
  invitationId?: string;
}) {
  return apiRequest<{ declined: boolean }>("/workspaces/invitations/decline", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resendInvitation(workspaceId: string, invitationId: string) {
  return apiRequest<InviteResult>(
    `/workspaces/${workspaceId}/invitations/${invitationId}/resend`,
    { method: "POST", workspaceId },
  );
}

export function revokeInvitation(workspaceId: string, invitationId: string) {
  return apiRequest<void>(
    `/workspaces/${workspaceId}/invitations/${invitationId}/revoke`,
    { method: "POST", workspaceId },
  );
}

export function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
) {
  return apiRequest<WorkspaceMember>(
    `/workspaces/${workspaceId}/members/${userId}`,
    {
      method: "PATCH",
      workspaceId,
      body: JSON.stringify({ role }),
    },
  );
}

export function removeMember(workspaceId: string, userId: string) {
  return apiRequest<void>(`/workspaces/${workspaceId}/members/${userId}`, {
    method: "DELETE",
    workspaceId,
  });
}
