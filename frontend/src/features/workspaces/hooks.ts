"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as workspacesApi from "@/features/workspaces/api";
import type { WorkspaceRole } from "@/features/workspaces/types";
import { useWorkspaceStore } from "@/store/workspace-store";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  members: (workspaceId: string) =>
    ["workspaces", workspaceId, "members"] as const,
  invitations: (workspaceId: string) =>
    ["workspaces", workspaceId, "invitations"] as const,
  mine: ["workspaces", "invitations", "mine"] as const,
  preview: (token: string) =>
    ["workspaces", "invitations", "preview", token] as const,
};

export function useWorkspaces(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: workspacesApi.listWorkspaces,
    staleTime: 60_000,
    enabled,
  });
}

export function useCurrentWorkspace() {
  const currentWorkspaceId = useWorkspaceStore(
    (state) => state.currentWorkspaceId,
  );
  const workspaces = useWorkspaces();
  return workspaces.data?.find((workspace) => workspace.id === currentWorkspaceId);
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const setCurrentWorkspaceId = useWorkspaceStore(
    (state) => state.setCurrentWorkspaceId,
  );

  return useMutation({
    mutationFn: workspacesApi.createWorkspace,
    onSuccess: (workspace) => {
      setCurrentWorkspaceId(workspace.id);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useUpdateWorkspace(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; description?: string; logo?: string }) =>
      workspacesApi.updateWorkspace(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useWorkspaceMembers(
  workspaceId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId ?? "none"),
    queryFn: () => workspacesApi.listMembers(workspaceId as string),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 60_000,
  });
}

export function useWorkspaceInvitations(
  workspaceId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: workspaceKeys.invitations(workspaceId ?? "none"),
    queryFn: () => workspacesApi.listInvitations(workspaceId as string),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 30_000,
  });
}

export function useInviteMember(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: "ADMIN" | "MEMBER" | "VIEWER" }) =>
      workspacesApi.inviteMember(workspaceId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId ?? "none"),
      });
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(workspaceId ?? "none"),
      });
    },
  });
}

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: workspaceKeys.preview(token),
    queryFn: () => workspacesApi.previewInvitation(token),
    enabled: token.length >= 16,
    retry: false,
  });
}

export function useMyInvitations(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.mine,
    queryFn: workspacesApi.listMyInvitations,
    enabled,
    staleTime: 20_000,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const setCurrentWorkspaceId = useWorkspaceStore(
    (state) => state.setCurrentWorkspaceId,
  );
  return useMutation({
    mutationFn: workspacesApi.acceptInvitation,
    onSuccess: (result) => {
      setCurrentWorkspaceId(result.workspaceId);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.mine });
    },
  });
}

export function useAcceptMyInvitation() {
  const queryClient = useQueryClient();
  const setCurrentWorkspaceId = useWorkspaceStore(
    (state) => state.setCurrentWorkspaceId,
  );
  return useMutation({
    mutationFn: workspacesApi.acceptMyInvitation,
    onSuccess: (result) => {
      setCurrentWorkspaceId(result.workspaceId);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.mine });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: workspacesApi.declineInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.mine });
    },
  });
}

export function useResendInvitation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      workspacesApi.resendInvitation(workspaceId as string, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(workspaceId ?? "none"),
      });
    },
  });
}

export function useRevokeInvitation(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      workspacesApi.revokeInvitation(workspaceId as string, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(workspaceId ?? "none"),
      });
    },
  });
}

export function useUpdateMemberRole(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      role: WorkspaceRole;
    }) =>
      workspacesApi.updateMemberRole(
        workspaceId as string,
        input.userId,
        input.role,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId ?? "none"),
      });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useRemoveMember(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      workspacesApi.removeMember(workspaceId as string, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId ?? "none"),
      });
    },
  });
}
