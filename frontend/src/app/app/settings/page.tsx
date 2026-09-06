"use client";

import { useState, type FormEvent } from "react";
import { PageHeader, PageShell, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";
import {
  useCurrentWorkspace,
  useInviteMember,
  useRemoveMember,
  useResendInvitation,
  useRevokeInvitation,
  useUpdateMemberRole,
  useUpdateWorkspace,
  useWorkspaceInvitations,
  useWorkspaceMembers,
} from "@/features/workspaces/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import { useUpdateNotificationPrefs } from "@/features/collaboration/hooks";
import { useNotifications } from "@/features/collaboration/hooks";
import { nativeSelectClass, readImageAsDataUrl } from "@/lib/utils";
import type { Workspace, WorkspaceRole } from "@/features/workspaces/types";

const SETTINGS_NAV = [
  { href: "#details", label: "Details" },
  { href: "#members", label: "Members" },
  { href: "#notifications", label: "Notifications" },
];

export default function WorkspaceSettingsPage() {
  const workspace = useCurrentWorkspace();

  if (!workspace) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Select a workspace.</p>
      </PageShell>
    );
  }

  return <WorkspaceSettings key={workspace.id} workspace={workspace} />;
}

function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  const canEdit = workspace.role === "OWNER";
  const canInvite = workspace.role === "OWNER" || workspace.role === "ADMIN";
  const members = useWorkspaceMembers(workspace.id);
  const invitations = useWorkspaceInvitations(workspace.id, canInvite);
  const updateWorkspace = useUpdateWorkspace(workspace.id);
  const inviteMember = useInviteMember(workspace.id);
  const updateMemberRole = useUpdateMemberRole(workspace.id);
  const removeMember = useRemoveMember(workspace.id);
  const resendInvitation = useResendInvitation(workspace.id);
  const revokeInvitation = useRevokeInvitation(workspace.id);
  const notifications = useNotifications(workspace.id);
  const updatePrefs = useUpdateNotificationPrefs();
  const currentUser = useCurrentUser();

  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [logo, setLogo] = useState(workspace.logo ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">(
    "MEMBER",
  );

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    await updateWorkspace.mutateAsync({
      name,
      description: description.trim() || undefined,
      logo: logo || undefined,
    });
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    await inviteMember.mutateAsync({
      email: inviteEmail,
      role: inviteRole,
    });
    setInviteEmail("");
  }

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description={`${workspace.name} · your role is ${workspace.role}`}
      />
      <div className="flex flex-col gap-8 lg:flex-row">
        <nav className="flex gap-2 overflow-x-auto lg:w-44 lg:shrink-0 lg:flex-col">
          {SETTINGS_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <Surface id="details" className="scroll-mt-24">
            <h2 className="text-base font-semibold tracking-tight">Details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only the workspace owner can edit these details.
            </p>
            <form className="mt-5 space-y-4" onSubmit={saveSettings}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Workspace logo</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  disabled={!canEdit}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void readImageAsDataUrl(file).then(setLogo);
                  }}
                />
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : null}
              </div>
              {canEdit ? (
                <Button type="submit" disabled={updateWorkspace.isPending}>
                  {updateWorkspace.isPending ? "Saving..." : "Save"}
                </Button>
              ) : null}
            </form>
          </Surface>

          <Surface id="members" className="scroll-mt-24">
            <h2 className="text-base font-semibold tracking-tight">Members</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              People with access to this workspace.
            </p>
            <div className="mt-5 space-y-4">
              {members.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <ul className="space-y-2">
                  {(members.data ?? []).map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-col gap-2 rounded-xl bg-secondary/70 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        {member.user.name}
                        <span className="ml-2 text-muted-foreground">
                          {member.user.email}
                        </span>
                      </span>
                      {canEdit && member.role !== "OWNER" ? (
                        <select
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                          value={member.role}
                          onChange={(event) =>
                            void updateMemberRole.mutateAsync({
                              userId: member.userId,
                              role: event.target.value as WorkspaceRole,
                            })
                          }
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      ) : (
                        <StatusBadge value={member.role} />
                      )}
                      {canInvite &&
                      member.role !== "OWNER" &&
                      member.userId !== currentUser.data?.id ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void removeMember.mutateAsync(member.userId)
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {canInvite ? (
                <form className="space-y-3 border-t border-border pt-4" onSubmit={sendInvite}>
                  <p className="text-sm font-medium">Invite a member</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                    <Input
                      type="email"
                      placeholder="nina.v@example.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      required
                    />
                    <select
                      className={nativeSelectClass}
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as typeof inviteRole)
                      }
                    >
                      {workspace.role === "OWNER" ? (
                        <option value="ADMIN">Admin</option>
                      ) : null}
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <Button type="submit" disabled={inviteMember.isPending}>
                      {inviteMember.isPending ? "Inviting..." : "Invite"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Invites expire in 7 days. If they already have an account,
                    they will get an in-app notification.
                  </p>
                  {inviteMember.error ? (
                    <p className="text-sm text-destructive">
                      {inviteMember.error.message}
                    </p>
                  ) : null}
                </form>
              ) : null}

              {canInvite && invitations.data && invitations.data.length > 0 ? (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-medium">Pending invitations</p>
                  {invitations.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {invitations.data.map((invitation) => (
                        <li
                          key={invitation.id}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            {invitation.email} · {invitation.role}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={resendInvitation.isPending}
                              onClick={() =>
                                void resendInvitation.mutateAsync(invitation.id)
                              }
                            >
                              Resend
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={revokeInvitation.isPending}
                              onClick={() =>
                                void revokeInvitation.mutateAsync(invitation.id)
                              }
                            >
                              Revoke
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </Surface>

          <Surface id="notifications" className="scroll-mt-24">
            <h2 className="text-base font-semibold tracking-tight">
              Notifications
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              In-app alerts are on by default. Email needs SMTP on the server.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifications.data?.prefs.inApp ?? true}
                  onChange={(event) =>
                    void updatePrefs.mutateAsync({ inApp: event.target.checked })
                  }
                />
                In-app notifications
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifications.data?.prefs.email ?? false}
                  onChange={(event) =>
                    void updatePrefs.mutateAsync({ email: event.target.checked })
                  }
                />
                Email notifications
              </label>
            </div>
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
