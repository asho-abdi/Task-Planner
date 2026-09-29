"use client";

import { Button } from "@/components/ui/button";
import { MemberAvatarGroup } from "@/components/member-avatar-group";
import { Surface } from "@/components/page-header";
import type { Team } from "@/features/collaboration/types";
import { nativeSelectClass } from "@/lib/utils";

export function TeamCard({
  team,
  canAdmin,
  memberOptions,
  selectedUserId,
  onSelectUser,
  onAdd,
  onRemove,
  onRole,
}: {
  team: Team;
  canAdmin: boolean;
  memberOptions: Array<{ userId: string; name: string }>;
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  onAdd: () => void;
  onRemove: (userId: string) => void;
  onRole: (userId: string, role: "ADMIN" | "MEMBER") => void;
}) {
  return (
    <Surface className="p-0 sm:p-0">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[12px] font-semibold text-primary">
            {team.icon || team.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-medium text-foreground">{team.name}</h2>
            {team.description ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">{team.description}</p>
            ) : null}
            <p className="mt-1 text-[12px] text-muted-foreground">
              {team._count.members} members · {team.activeTaskCount} active tasks
            </p>
          </div>
        </div>
        <MemberAvatarGroup people={team.members.map((item) => item.user)} />
      </div>
      <TeamMembers
        team={team}
        canAdmin={canAdmin}
        onRemove={onRemove}
        onRole={onRole}
      />
      {canAdmin ? (
        <form
          className="flex gap-2 border-t border-border px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd();
          }}
        >
          <select
            className={nativeSelectClass}
            value={selectedUserId}
            onChange={(event) => onSelectUser(event.target.value)}
          >
            <option value="">Add member</option>
            {memberOptions.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            Add
          </Button>
        </form>
      ) : null}
    </Surface>
  );
}

export function TeamMembers({
  team,
  canAdmin,
  onRemove,
  onRole,
}: {
  team: Team;
  canAdmin: boolean;
  onRemove: (userId: string) => void;
  onRole: (userId: string, role: "ADMIN" | "MEMBER") => void;
}) {
  return (
    <ul className="border-t border-border text-sm">
      {team.members.map((member) => (
        <li
          key={member.id}
          className="flex items-center justify-between gap-2 px-4 py-2"
        >
          <span>
            {member.user.name}
            <span className="ml-2 text-xs text-muted-foreground">
              {member.role === "ADMIN" ? "Team Admin" : "Team Member"}
            </span>
          </span>
          {canAdmin ? (
            <span className="flex items-center gap-1">
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                value={member.role}
                onChange={(event) =>
                  onRole(member.userId, event.target.value as "ADMIN" | "MEMBER")
                }
              >
                <option value="ADMIN">Team Admin</option>
                <option value="MEMBER">Team Member</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRemove(member.userId)}
              >
                Remove
              </Button>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
