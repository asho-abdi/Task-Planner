"use client";

import { useState, type FormEvent } from "react";
import { Check, FolderKanban, Globe, Link2, Lock, UserPlus, X } from "lucide-react";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, nativeSelectClass } from "@/lib/utils";

export type TaskVisibility = "PRIVATE" | "PROJECT" | "WORKSPACE";
export type TaskSharePermission = "VIEW" | "COMMENT" | "EDIT";

const VISIBILITY_OPTIONS: Array<{
  value: TaskVisibility;
  label: string;
  hint: string;
  icon: typeof Lock;
}> = [
  { value: "PRIVATE", label: "Private", hint: "Only people added below", icon: Lock },
  { value: "PROJECT", label: "Project", hint: "Project members", icon: FolderKanban },
  { value: "WORKSPACE", label: "Workspace", hint: "Everyone in the workspace", icon: Globe },
];

const PERMISSION_LABELS: Record<TaskSharePermission, string> = {
  VIEW: "Can view",
  COMMENT: "Can comment",
  EDIT: "Can edit",
};

export function ShareDialog({
  open,
  onOpenChange,
  visibility,
  members,
  shares,
  link,
  onVisibility,
  onShare,
  onUnshare,
  sharing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibility: TaskVisibility;
  members: Array<{ userId: string; name: string }>;
  shares: Array<{
    userId: string;
    permission: TaskSharePermission;
    user: { name: string };
  }>;
  link: string;
  onVisibility: (visibility: TaskVisibility) => void;
  onShare: (userId: string, permission: TaskSharePermission) => Promise<void>;
  onUnshare: (userId: string) => Promise<void>;
  /** Optional pending flag for the Share button. */
  sharing?: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<TaskSharePermission>("VIEW");
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleShare(event: FormEvent) {
    event.preventDefault();
    if (!userId) return;
    await onShare(userId, permission);
    setUserId("");
  }

  return (
    <CreateResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share task"
      description="Choose who can open this task. Private tasks never appear to people without access, even with the link."
      className="max-w-xl"
    >
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">
            General access
          </legend>
          <div role="radiogroup" aria-label="Visibility" className="grid gap-2 sm:grid-cols-3">
            {VISIBILITY_OPTIONS.map((option) => {
              const active = visibility === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    if (!active) onVisibility(option.value);
                  }}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/40 bg-primary-soft"
                      : "border-border bg-card hover:border-border-strong hover:bg-muted/60",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      active ? "text-primary-soft-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <form className="space-y-2" onSubmit={(event) => void handleShare(event).catch(() => undefined)}>
          <Label htmlFor="share-user">Add people</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              id="share-user"
              className={cn(nativeSelectClass, "sm:flex-1")}
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">Share with…</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Permission"
              className={cn(nativeSelectClass, "sm:w-36")}
              value={permission}
              onChange={(event) =>
                setPermission(event.target.value as TaskSharePermission)
              }
            >
              <option value="VIEW">Can view</option>
              <option value="COMMENT">Can comment</option>
              <option value="EDIT">Can edit</option>
            </select>
            <Button type="submit" disabled={!userId} loading={sharing}>
              <UserPlus />
              Share
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">People with access</p>
          {shares.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {shares.map((share) => (
                <li
                  key={share.userId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={share.user.name} size="sm" />
                    <span className="truncate text-base text-foreground">
                      {share.user.name}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline">{PERMISSION_LABELS[share.permission]}</Badge>
                    <Tooltip content="Remove access">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Remove ${share.user.name}`}
                        loading={removingId === share.userId}
                        onClick={() => {
                          setRemovingId(share.userId);
                          void onUnshare(share.userId)
                            .catch(() => undefined)
                            .finally(() => setRemovingId(null));
                        }}
                      >
                        <X />
                      </Button>
                    </Tooltip>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
              Not shared with anyone individually yet.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="min-w-0 truncate text-xs text-subtle-foreground">{link}</p>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Link2 />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
    </CreateResourceDialog>
  );
}
