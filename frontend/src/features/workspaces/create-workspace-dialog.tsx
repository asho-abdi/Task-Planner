"use client";

import { useState, type FormEvent } from "react";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  useCreateWorkspace,
  useWorkspaces,
} from "@/features/workspaces/hooks";
import { WorkspaceMark } from "@/features/workspaces/workspace-switcher";
import { nativeSelectClass, readImageAsDataUrl } from "@/lib/utils";

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const workspaces = useWorkspaces(open);
  const createWorkspace = useCreateWorkspace();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setDescription("");
      setLogo(null);
      setLogoError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const workspaceName = name.trim();
      await createWorkspace.mutateAsync({
        name,
        description: description.trim() || undefined,
        logo: logo ?? undefined,
      });
      handleOpenChange(false);
      toast.success(`Workspace “${workspaceName}” created`);
    } catch {
      // Error is shown from the mutation.
    }
  }

  return (
    <CreateResourceDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="New workspace"
      description="Create a workspace. Existing workspaces load in the background."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-workspace-form"
            disabled={!name.trim()}
            loading={createWorkspace.isPending}
          >
            Create workspace
          </Button>
        </>
      }
    >
      <form id="create-workspace-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-3">
          <WorkspaceMark
            name={name.trim() || "W"}
            logo={logo}
            className="size-12 rounded-xl text-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-foreground">
              {name.trim() || "Untitled workspace"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {description.trim() || "Preview of how it appears in the switcher"}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace-name">Name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Product team"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace-description">Description</Label>
          <Input
            id="workspace-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace-logo">Workspace logo</Label>
          <Input
            id="workspace-logo"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setLogoError(null);
              if (!file) {
                setLogo(null);
                return;
              }
              void readImageAsDataUrl(file)
                .then(setLogo)
                .catch((error: Error) => {
                  setLogo(null);
                  setLogoError(error.message);
                });
            }}
          />
          {logoError ? (
            <p className="text-sm text-danger-soft-foreground">{logoError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Optional. Square images work best.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace-copy-from">Copy settings from</Label>
          {workspaces.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <select
              id="workspace-copy-from"
              className={nativeSelectClass}
              defaultValue=""
              disabled
            >
              <option value="">None</option>
              {(workspaces.data ?? []).map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-muted-foreground">
            Copying settings from another workspace is not available yet.
          </p>
        </div>
        {createWorkspace.error ? (
          <p className="text-sm text-danger-soft-foreground">
            {createWorkspace.error.message}
          </p>
        ) : null}
      </form>
    </CreateResourceDialog>
  );
}
