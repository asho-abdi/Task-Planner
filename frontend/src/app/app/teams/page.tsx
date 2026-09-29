"use client";

import { useState, type FormEvent } from "react";
import { Plus, UsersRound } from "lucide-react";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonCards } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { TeamCard, TeamMark } from "@/features/collaboration/team-ui";
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

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
  const [creating, setCreating] = useState(false);
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

  /** Team member calls go straight to the API (not a mutation), so toast both outcomes here. */
  async function withToast(task: () => Promise<unknown>, success: string) {
    try {
      await task();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      const teamName = name.trim();
      await createTeam.mutateAsync({
        name: teamName,
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
      });
      setName("");
      setDescription("");
      setIcon("");
      setCreating(false);
      toast.success(`Team “${teamName}” created`);
    } catch {
      // Error is shown from the mutation.
    }
  }

  const newTeamButton = canWrite ? (
    <Button size="sm" onClick={() => setCreating(true)}>
      <Plus />
      New team
    </Button>
  ) : null;

  return (
    <PageShell>
      <PageHeader
        title="Teams"
        icon={UsersRound}
        description="Groups of people who share projects and work."
        actions={newTeamButton}
      />

      {canWrite ? (
        <CreateResourceDialog
          open={creating}
          onOpenChange={setCreating}
          title="New team"
          description="Group people who work together. You can add members after creating it."
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-team-form"
                loading={createTeam.isPending}
                disabled={!name.trim()}
              >
                Create team
              </Button>
            </>
          }
        >
          <form id="create-team-form" className="space-y-4" onSubmit={onCreate}>
            <div className="flex items-end gap-3">
              <TeamMark team={{ name: name || "?", icon: icon.trim() || null }} className="size-9" />
              <div className="w-24 space-y-1.5">
                <Label htmlFor="team-icon">Icon</Label>
                <Input
                  id="team-icon"
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                  placeholder="D"
                  maxLength={4}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="team-name">Name</Label>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Design"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-description">Description</Label>
              <Input
                id="team-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </div>
            {createTeam.error ? (
              <p className="text-sm text-danger-soft-foreground">
                {createTeam.error.message}
              </p>
            ) : null}
          </form>
        </CreateResourceDialog>
      ) : null}

      {teams.isLoading ? (
        <SkeletonCards count={4} className="sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2" />
      ) : teams.isError ? (
        <ErrorState
          title="Couldn't load teams"
          description={teams.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void teams.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !teams.data?.length ? (
        <EmptyState
          icon={UsersRound}
          title="No teams yet"
          description="Create a team to group people who work on the same projects."
          action={newTeamButton}
        />
      ) : (
        <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
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
                  const person = members.data?.find((member) => member.userId === userId);
                  await withToast(
                    () => addTeamMember(team.id, userId),
                    `${person?.user.name ?? "Member"} added to ${team.name}`,
                  );
                  setMemberByTeam((current) => ({ ...current, [team.id]: "" }));
                  await refresh();
                }}
                onRemove={async (userId) => {
                  const person = team.members.find((member) => member.userId === userId);
                  await withToast(
                    () => removeTeamMember(team.id, userId),
                    `${person?.user.name ?? "Member"} removed from ${team.name}`,
                  );
                  await refresh();
                }}
                onRole={async (userId, role) => {
                  const person = team.members.find((member) => member.userId === userId);
                  await withToast(
                    () => updateTeamMemberRole(team.id, userId, role),
                    `${person?.user.name ?? "Member"} is now ${
                      role === "ADMIN" ? "a Team Admin" : "a Team Member"
                    }`,
                  );
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
