"use client";

import { useState, type FormEvent } from "react";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { OptionalAttachments } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/features/projects/hooks";
import { PRIORITIES } from "@/features/projects/types";
import { useTeams, useUploadFile } from "@/features/collaboration/hooks";
import { nativeSelectClass, nativeTextareaClass } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [teamId, setTeamId] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("MEDIUM");
  const [files, setFiles] = useState<File[]>([]);
  const createProject = useCreateProject();
  const upload = useUploadFile();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const teams = useTeams(open ? workspaceId : null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setDescription("");
      setIcon("");
      setTeamId("");
      setPriority("MEDIUM");
      setFiles([]);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await createProject.mutateAsync({
        name,
        description: description.trim() || undefined,
        priority,
        icon: icon.trim() || undefined,
        teamId: teamId || undefined,
      });
      for (const file of files) {
        await upload.mutateAsync({
          file,
          attach: { projectId: created.id },
        });
      }
      handleOpenChange(false);
    } catch {
      // Error is shown from the mutation.
    }
  }

  return (
    <CreateResourceDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="New project"
      description="Add a project to this workspace."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-project-form"
            disabled={
              !name.trim() || createProject.isPending || upload.isPending
            }
          >
            {createProject.isPending || upload.isPending ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <form
        id="create-project-form"
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Website redesign"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-description">Description</Label>
          <textarea
            id="project-description"
            className={nativeTextareaClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="project-icon">Icon</Label>
            <Input
              id="project-icon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              placeholder="📁"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-team">Team</Label>
            <select
              id="project-team"
              className={nativeSelectClass}
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">No team</option>
              {(teams.data ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-priority">Priority</Label>
          <select
            id="project-priority"
            className={nativeSelectClass}
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as (typeof PRIORITIES)[number])
            }
          >
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <OptionalAttachments
          inputId="project-files"
          files={files}
          onChange={setFiles}
          disabled={createProject.isPending || upload.isPending}
        />
        {createProject.error ? (
          <p className="text-sm text-destructive">{createProject.error.message}</p>
        ) : null}
        {upload.error ? (
          <p className="text-sm text-destructive">{upload.error.message}</p>
        ) : null}
      </form>
    </CreateResourceDialog>
  );
}
