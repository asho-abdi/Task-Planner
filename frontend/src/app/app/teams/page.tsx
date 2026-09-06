"use client";

import { useState, type FormEvent } from "react";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamCard } from "@/features/collaboration/team-ui";
import {
  collabKeys,
  useCreateTeam,
  useTeams,
} from "@/features/collaboration/hooks";
import {
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
} from "@/features/collaboration/api";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/hooks";
import {
  useCurrentWorkspace,
  useWorkspaceMembers,
} from "@/features/workspaces/hooks";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function TeamsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const teams = useTeams(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const createTeam = useCreateTeam();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const canWrite = workspace && workspace.role !== "VIEWER";
  const canAdmin = workspace?.role === "OWNER" || workspace?.role === "ADMIN";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [memberByTeam, setMemberByTeam] = useState<Record<string, string>>({});

  async function refresh() {
    if (workspaceId) {
      await queryClient.invalidateQueries({
        queryKey: collabKeys.teams(workspaceId),
      });
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await createTeam.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
      });
      setName("");
      setDescription("");
      setIcon("");
    } catch {
      // Error is shown from the mutation.
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Teams"
        description="Group people who share projects. A General team is created with the workspace."
      />
      {canWrite ? (
        <form
          className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5"
          onSubmit={onCreate}
        >
          <div className="grid gap-3 sm:grid-cols-[80px_1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="team-icon">Icon</Label>
              <Input
                id="team-icon"
                value={icon}
                onChange={(event) => setIcon(event.target.value)}
                placeholder="🛠️"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Development"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="team-description">Description</Label>
              <Input
                id="team-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createTeam.isPending || !name.trim()}>
                Create team
              </Button>
            </div>
          </div>
          {createTeam.error ? (
            <p className="mt-2 text-sm text-destructive">
              {createTeam.error.message}
            </p>
          ) : null}
        </form>
      ) : null}
      {teams.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : teams.isError ? (
        <p className="text-sm text-destructive">{teams.error.message}</p>
      ) : !teams.data?.length ? (
        <EmptyState title="No teams yet" />
      ) : (
        <div className="space-y-4">
          {teams.data.map((team) => {
            const isTeamAdmin = team.members.some(
              (member) =>
                member.role === "ADMIN" && member.userId === currentUser.data?.id,
            );
            const canManageTeam = Boolean(canAdmin) || Boolean(isTeamAdmin);
            return (
              <TeamCard
                key={team.id}
                team={team}
                canAdmin={canManageTeam}
                memberOptions={(members.data ?? [])
                  .filter(
                    (member) =>
                      !team.members.some((item) => item.userId === member.userId),
                  )
                  .map((member) => ({
                    userId: member.userId,
                    name: member.user.name,
                  }))}
                selectedUserId={memberByTeam[team.id] ?? ""}
                onSelectUser={(userId) =>
                  setMemberByTeam((current) => ({
                    ...current,
                    [team.id]: userId,
                  }))
                }
                onAdd={async () => {
                  const userId = memberByTeam[team.id];
                  if (!userId) return;
                  await addTeamMember(team.id, userId);
                  setMemberByTeam((current) => ({ ...current, [team.id]: "" }));
                  await refresh();
                }}
                onRemove={async (userId) => {
                  await removeTeamMember(team.id, userId);
                  await refresh();
                }}
                onRole={async (userId, role) => {
                  await updateTeamMemberRole(team.id, userId, role);
                  await refresh();
                }}
              />
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
