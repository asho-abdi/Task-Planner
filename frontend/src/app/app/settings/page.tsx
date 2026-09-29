"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Mail,
  Palette,
  RotateCw,
  Settings,
  UserMinus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeSegmented } from "@/components/theme-toggle";
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
import { WorkspaceMark } from "@/features/workspaces/workspace-switcher";
import { useCurrentUser } from "@/features/auth/hooks";
import { useUpdateNotificationPrefs } from "@/features/collaboration/hooks";
import { useNotifications } from "@/features/collaboration/hooks";
import { Switch } from "@/features/collaboration/switch";
import {
  cn,
  formatDate,
  nativeSelectClass,
  readImageAsDataUrl,
} from "@/lib/utils";
import type { Workspace, WorkspaceRole } from "@/features/workspaces/types";

const SETTINGS_NAV: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "details", label: "Workspace", icon: Building2 },
  { id: "members", label: "Members", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
  SUPER_ADMIN: "Super admin",
};

const ROLE_TONE: Record<string, BadgeVariant> = {
  OWNER: "primary",
  SUPER_ADMIN: "primary",
  ADMIN: "info",
  MEMBER: "default",
  VIEWER: "outline",
};

function RoleBadge({ role }: { role: string }) {
  return <Badge variant={ROLE_TONE[role] ?? "default"}>{ROLE_LABEL[role] ?? role}</Badge>;
}

export default function WorkspaceSettingsPage() {
  const workspace = useCurrentWorkspace();

  if (!workspace) {
    return (
      <PageShell>
        <PageHeader title="Settings" icon={Settings} />
        <EmptyState
          icon={Building2}
          title="No workspace selected"
          description="Pick a workspace from the switcher to manage its settings."
        />
      </PageShell>
    );
  }

  return <WorkspaceSettings key={workspace.id} workspace={workspace} />;
}

function SettingsSection({
  id,
  title,
  description,
  children,
  footer,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card shadow-xs"
    >
      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8 lg:grid-cols-1 lg:gap-5 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
        <div className="space-y-1">
          <h2
            id={`${id}-title`}
            className="font-heading text-md font-semibold tracking-[-0.02em] text-foreground"
          >
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
      {footer ? (
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [ids]);
  return [active, setActive] as const;
}

const SECTION_IDS = SETTINGS_NAV.map((item) => item.id);

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
  const [activeSection, setActiveSection] = useActiveSection(SECTION_IDS);

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
    toast.success("Workspace settings saved");
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    const email = inviteEmail;
    await inviteMember.mutateAsync({
      email,
      role: inviteRole,
    });
    setInviteEmail("");
    toast.success(`Invitation sent to ${email}`);
  }

  const inApp = notifications.data?.prefs.inApp ?? true;
  const emailPref = notifications.data?.prefs.email ?? false;
  const me = currentUser.data;

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        icon={Settings}
        description={
          <>
            Manage your profile, appearance and the{" "}
            <span className="font-medium text-foreground">{workspace.name}</span>{" "}
            workspace.
          </>
        }
        meta={
          <>
            <span>Your role</span>
            <RoleBadge role={workspace.role} />
          </>
        }
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label="Settings sections"
          className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pb-2 lg:sticky lg:top-6 lg:mx-0 lg:w-48 lg:shrink-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-0 lg:pb-0"
        >
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={active ? "true" : undefined}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <SettingsSection
            id="profile"
            title="Profile"
            description="Your personal account on this installation."
          >
            {currentUser.isLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="size-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ) : me ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar name={me.name} size="xl" />
                <dl className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Name</dt>
                    <dd className="truncate text-base font-medium text-foreground">
                      {me.name}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="truncate text-base text-foreground">{me.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Platform role</dt>
                    <dd className="mt-0.5">
                      <RoleBadge role={me.role} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Member since</dt>
                    <dd className="tabular text-base text-foreground">
                      {formatDate(me.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Profile details are unavailable.
              </p>
            )}
          </SettingsSection>

          <SettingsSection
            id="appearance"
            title="Appearance"
            description="Choose how Task Planner looks on this device."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-base font-medium text-foreground">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Light, dark, or follow your system setting. Saved in this browser.
                </p>
              </div>
              <ThemeSegmented className="self-start sm:self-auto" />
            </div>
          </SettingsSection>

          <SettingsSection
            id="details"
            title="Workspace"
            description={
              canEdit
                ? "Name, description and logo shown across the workspace."
                : "Only the workspace owner can edit these details."
            }
          >
            <form id="workspace-details-form" className="space-y-4" onSubmit={saveSettings}>
              <div className="flex items-center gap-4">
                <WorkspaceMark
                  name={name || workspace.name}
                  logo={logo || null}
                  className="size-14 rounded-xl text-xl"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
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
                  <p className="text-xs text-muted-foreground">
                    Square images work best.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    placeholder="What this workspace is for"
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {canEdit ? (
                <div className="flex justify-end">
                  <Button type="submit" loading={updateWorkspace.isPending}>
                    Save changes
                  </Button>
                </div>
              ) : null}
            </form>
          </SettingsSection>

          <SettingsSection
            id="members"
            title="Members & invitations"
            description="People with access to this workspace and pending invites."
          >
            <div className="space-y-5">
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="hidden grid-cols-[minmax(0,1fr)_140px_40px] items-center gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Member</span>
                  <span>Role</span>
                  <span className="sr-only">Actions</span>
                </div>
                {members.isLoading ? (
                  <div role="status" aria-label="Loading members" className="divide-y divide-border">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex items-center gap-3 px-3 py-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-2.5 w-48" />
                        </div>
                        <Skeleton className="h-7 w-24" />
                      </div>
                    ))}
                  </div>
                ) : members.isError ? (
                  <div className="p-3">
                    <ErrorState
                      title="Couldn't load members"
                      description={members.error.message}
                      action={
                        <Button size="xs" variant="outline" onClick={() => void members.refetch()}>
                          Retry
                        </Button>
                      }
                    />
                  </div>
                ) : !(members.data ?? []).length ? (
                  <EmptyState compact icon={Users} title="No members yet" />
                ) : (
                  <ul className="divide-y divide-border">
                    {(members.data ?? []).map((member) => {
                      const isMe = member.userId === currentUser.data?.id;
                      const canRemove = canInvite && member.role !== "OWNER" && !isMe;
                      const removing =
                        removeMember.isPending && removeMember.variables === member.userId;
                      const changingRole =
                        updateMemberRole.isPending &&
                        updateMemberRole.variables?.userId === member.userId;
                      return (
                        <li
                          key={member.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={member.user.name} />
                            <div className="min-w-0">
                              <p className="truncate text-base font-medium text-foreground">
                                {member.user.name}
                                {isMe ? (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    (you)
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {member.user.email}
                              </p>
                            </div>
                          </div>
                          <div className="col-start-1 row-start-2 pl-11 sm:col-start-auto sm:row-start-auto sm:pl-0">
                            {canEdit && member.role !== "OWNER" ? (
                              <select
                                aria-label={`Role for ${member.user.name}`}
                                className={cn(nativeSelectClass, "h-8 w-full max-w-40 text-sm")}
                                value={member.role}
                                disabled={changingRole}
                                onChange={(event) => {
                                  const role = event.target.value as WorkspaceRole;
                                  void updateMemberRole
                                    .mutateAsync({ userId: member.userId, role })
                                    .then(() =>
                                      toast.success(
                                        `${member.user.name} is now ${ROLE_LABEL[role] ?? role}`,
                                      ),
                                    )
                                    .catch(() => undefined);
                                }}
                              >
                                <option value="ADMIN">Admin</option>
                                <option value="MEMBER">Member</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                            ) : (
                              <RoleBadge role={member.role} />
                            )}
                          </div>
                          <div className="col-start-2 row-span-2 row-start-1 flex justify-end sm:col-start-auto sm:row-span-1 sm:row-start-auto">
                            {canRemove ? (
                              <Tooltip content="Remove from workspace">
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Remove ${member.user.name}`}
                                  loading={removing}
                                  className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                                  onClick={() =>
                                    void removeMember
                                      .mutateAsync(member.userId)
                                      .then(() =>
                                        toast.success(`${member.user.name} removed`),
                                      )
                                      .catch(() => undefined)
                                  }
                                >
                                  <UserMinus />
                                </Button>
                              </Tooltip>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {canInvite ? (
                <form className="space-y-2.5" onSubmit={sendInvite}>
                  <Label htmlFor="invite-email">Invite a member</Label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                    <div className="relative">
                      <Mail
                        aria-hidden
                        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
                      />
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="nina.v@example.com"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        className="pl-8"
                        required
                      />
                    </div>
                    <select
                      aria-label="Invite role"
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
                    <Button type="submit" loading={inviteMember.isPending}>
                      Send invite
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Invites expire in 7 days. If they already have an account,
                    they will get an in-app notification.
                  </p>
                  {inviteMember.error ? (
                    <p className="text-sm text-danger-soft-foreground">
                      {inviteMember.error.message}
                    </p>
                  ) : null}
                </form>
              ) : null}

              {canInvite && invitations.isLoading ? (
                <Skeleton className="h-14 w-full rounded-lg" />
              ) : null}

              {canInvite && invitations.data && invitations.data.length > 0 ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    Pending invitations
                    <Badge className="tabular">{invitations.data.length}</Badge>
                  </p>
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {invitations.data.map((invitation) => {
                      const resending =
                        resendInvitation.isPending &&
                        resendInvitation.variables === invitation.id;
                      const revoking =
                        revokeInvitation.isPending &&
                        revokeInvitation.variables === invitation.id;
                      return (
                        <li
                          key={invitation.id}
                          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-muted-foreground">
                              <Mail className="size-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-base text-foreground">
                                {invitation.email}
                              </p>
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <RoleBadge role={invitation.role} />
                                <span>Expires {formatDate(invitation.expiresAt)}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 pl-11 sm:pl-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={resending}
                              disabled={resendInvitation.isPending && !resending}
                              onClick={() =>
                                void resendInvitation
                                  .mutateAsync(invitation.id)
                                  .then(() =>
                                    toast.success(`Invitation resent to ${invitation.email}`),
                                  )
                                  .catch(() => undefined)
                              }
                            >
                              <RotateCw />
                              Resend
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              loading={revoking}
                              disabled={revokeInvitation.isPending && !revoking}
                              onClick={() =>
                                void revokeInvitation
                                  .mutateAsync(invitation.id)
                                  .then(() => toast.success("Invitation revoked"))
                                  .catch(() => undefined)
                              }
                            >
                              <X />
                              Revoke
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </SettingsSection>

          <SettingsSection
            id="notifications"
            title="Notifications"
            description="In-app alerts are on by default. Email needs SMTP on the server."
          >
            <div className="divide-y divide-border rounded-lg border border-border">
              <PrefRow
                id="pref-in-app"
                title="In-app notifications"
                description="Mentions, assignments and reminders in your inbox."
                checked={inApp}
                disabled={notifications.isLoading}
                onChange={(checked) =>
                  void updatePrefs
                    .mutateAsync({ inApp: checked })
                    .then(() =>
                      toast.success(
                        `In-app notifications ${checked ? "enabled" : "disabled"}`,
                      ),
                    )
                    .catch(() => undefined)
                }
              />
              <PrefRow
                id="pref-email"
                title="Email notifications"
                description="A copy of important notifications sent to your email."
                checked={emailPref}
                disabled={notifications.isLoading}
                onChange={(checked) =>
                  void updatePrefs
                    .mutateAsync({ email: checked })
                    .then(() =>
                      toast.success(
                        `Email notifications ${checked ? "enabled" : "disabled"}`,
                      ),
                    )
                    .catch(() => undefined)
                }
              />
            </div>
          </SettingsSection>
        </div>
      </div>
    </PageShell>
  );
}

function PrefRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-base font-medium text-foreground">
          {title}
        </p>
        <p id={`${id}-desc`} className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        onCheckedChange={onChange}
      />
    </div>
  );
}
