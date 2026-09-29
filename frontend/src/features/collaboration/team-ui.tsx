"use client";

import { useState } from "react";
import { ListChecks, Shield, UserMinus, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { Team } from "@/features/collaboration/types";
import { cn, nativeSelectClass } from "@/lib/utils";

type MaybePromise = void | Promise<void>;

/** Runs an async handler while tracking a pending key, swallowing errors (they're toasted by the caller). */
function usePendingKey() {
  const [pending, setPending] = useState<string | null>(null);
  async function run(key: string, task: () => MaybePromise) {
    setPending(key);
    try {
      await task();
    } catch {
      // Caller surfaces the error.
    } finally {
      setPending(null);
    }
  }
  return [pending, run] as const;
}

export function TeamMark({ team, className }: { team: Pick<Team, "name" | "icon">; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft font-heading text-md font-semibold text-primary-soft-foreground",
        className,
      )}
    >
      {team.icon || team.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

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
  onAdd: () => MaybePromise;
  onRemove: (userId: string) => MaybePromise;
  onRole: (userId: string, role: "ADMIN" | "MEMBER") => MaybePromise;
}) {
  const [pending, run] = usePendingKey();
  const selectId = `team-add-${team.id}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow duration-150 hover:shadow-sm">
      <header className="flex items-start gap-3 p-4 sm:p-5">
        <TeamMark team={team} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-md font-semibold tracking-[-0.02em] text-foreground">
            {team.name}
          </h2>
          {team.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {team.description}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-subtle-foreground">No description</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {team.members.length ? (
              <AvatarStack
                people={team.members.map((item) => item.user)}
                max={5}
                size="default"
              />
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span className="tabular">{team._count.members}</span>
              {team._count.members === 1 ? "member" : "members"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="size-3.5" />
              <span className="tabular">{team.activeTaskCount}</span> active tasks
            </span>
          </div>
        </div>
      </header>
      <TeamMembers
        team={team}
        canAdmin={canAdmin}
        pendingKey={pending}
        onRemove={(userId) => run(`remove:${userId}`, () => onRemove(userId))}
        onRole={(userId, role) => run(`role:${userId}`, () => onRole(userId, role))}
      />
      {canAdmin ? (
        <form
          className="mt-auto flex gap-2 border-t border-border bg-muted/40 px-4 py-3 sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            void run("add", onAdd);
          }}
        >
          <label htmlFor={selectId} className="sr-only">
            Add member to {team.name}
          </label>
          <select
            id={selectId}
            className={cn(nativeSelectClass, "h-8 min-w-0 flex-1 text-sm")}
            value={selectedUserId}
            onChange={(event) => onSelectUser(event.target.value)}
          >
            <option value="">
              {memberOptions.length ? "Add member…" : "Everyone is already on this team"}
            </option>
            {memberOptions.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!selectedUserId}
            loading={pending === "add"}
          >
            <UserPlus />
            Add
          </Button>
        </form>
      ) : null}
    </article>
  );
}

export function TeamMembers({
  team,
  canAdmin,
  onRemove,
  onRole,
  pendingKey,
}: {
  team: Team;
  canAdmin: boolean;
  onRemove: (userId: string) => MaybePromise;
  onRole: (userId: string, role: "ADMIN" | "MEMBER") => MaybePromise;
  pendingKey?: string | null;
}) {
  if (!team.members.length) {
    return (
      <p className="border-t border-border px-4 py-4 text-sm text-muted-foreground sm:px-5">
        No members yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border border-t border-border">
      {team.members.map((member) => {
        const roleLabel = member.role === "ADMIN" ? "Team Admin" : "Team Member";
        return (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={member.user.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-base text-foreground">{member.user.name}</p>
                {!canAdmin ? null : (
                  <p className="truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                )}
              </div>
            </div>
            {canAdmin ? (
              <span className="flex shrink-0 items-center gap-1">
                <select
                  aria-label={`Team role for ${member.user.name}`}
                  className={cn(nativeSelectClass, "h-8 w-auto text-sm")}
                  value={member.role}
                  disabled={pendingKey === `role:${member.userId}`}
                  onChange={(event) =>
                    void onRole(member.userId, event.target.value as "ADMIN" | "MEMBER")
                  }
                >
                  <option value="ADMIN">Team Admin</option>
                  <option value="MEMBER">Team Member</option>
                </select>
                <Tooltip content="Remove from team">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${member.user.name} from ${team.name}`}
                    loading={pendingKey === `remove:${member.userId}`}
                    className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                    onClick={() => void onRemove(member.userId)}
                  >
                    <UserMinus />
                  </Button>
                </Tooltip>
              </span>
            ) : (
              <Badge variant={member.role === "ADMIN" ? "primary" : "default"}>
                {member.role === "ADMIN" ? <Shield /> : null}
                {roleLabel}
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
