"use client";

import { useState, type FormEvent } from "react";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { nativeSelectClass } from "@/lib/utils";

export type TaskVisibility = "PRIVATE" | "PROJECT" | "WORKSPACE";
export type TaskSharePermission = "VIEW" | "COMMENT" | "EDIT";

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
}) {
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<TaskSharePermission>("VIEW");
  const [copied, setCopied] = useState(false);

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
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Visibility</Label>
          <select
            className={nativeSelectClass}
            value={visibility}
            onChange={(event) =>
              onVisibility(event.target.value as TaskVisibility)
            }
          >
            <option value="PRIVATE">Private</option>
            <option value="PROJECT">Project members</option>
            <option value="WORKSPACE">Workspace members</option>
          </select>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleShare}>
          <select
            className={nativeSelectClass}
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
            className={nativeSelectClass}
            value={permission}
            onChange={(event) =>
              setPermission(event.target.value as TaskSharePermission)
            }
          >
            <option value="VIEW">Can view</option>
            <option value="COMMENT">Can comment</option>
            <option value="EDIT">Can edit</option>
          </select>
          <Button type="submit">Share</Button>
        </form>
        <ul className="space-y-2 text-sm">
          {shares.map((share) => (
            <li
              key={share.userId}
              className="flex items-center justify-between gap-2"
            >
              <span>
                {share.user.name} · {share.permission.toLowerCase()}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void onUnshare(share.userId)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </CreateResourceDialog>
  );
}
