"use client";

import { useState, type FormEvent } from "react";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateWorkspace,
  useWorkspaces,
} from "@/features/workspaces/hooks";
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
      await createWorkspace.mutateAsync({
        name,
        description: description.trim() || undefined,
        logo: logo ?? undefined,
      });
      handleOpenChange(false);
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
            disabled={!name.trim() || createWorkspace.isPending}
          >
            Create
          </Button>
        </>
      }
    >
      <form id="create-workspace-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Product team"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-description">Description</Label>
          <Input
            id="workspace-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
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
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : null}
          {logoError ? (
            <p className="text-sm text-destructive">{logoError}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Copy settings from</Label>
          {workspaces.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <select className={nativeSelectClass} defaultValue="" disabled>
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
          <p className="text-sm text-destructive">
            {createWorkspace.error.message}
          </p>
        ) : null}
      </form>
    </CreateResourceDialog>
  );
}
