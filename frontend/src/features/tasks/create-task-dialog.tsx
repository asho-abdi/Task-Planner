"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { OptionalAttachments } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useProjects } from "@/features/projects/hooks";
import { useCreateTask } from "@/features/tasks/hooks";
import { PeoplePicker } from "@/features/tasks/people-picker";
import { useWorkload } from "@/features/insights/hooks";
import type { WorkloadUser } from "@/features/insights/types";
import {
  PRIORITIES,
  type Priority,
} from "@/features/tasks/types";
import { useTeams, useUploadFile } from "@/features/collaboration/hooks";
import { useWorkspaceMembers } from "@/features/workspaces/hooks";
import {
  fromDateInputValue,
  localDateYmd,
  nativeSelectClass,
  nativeTextareaClass,
} from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

type CreateTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function CreateTaskDialog({
  open,
  onOpenChange,
}: CreateTaskDialogProps) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const defaultProjectId = useUiStore((state) => state.createTaskProjectId);
  const projects = useProjects(workspaceId, false, open);
  const members = useWorkspaceMembers(workspaceId, open);
  const teams = useTeams(open ? workspaceId : null);
  const workload = useWorkload(open ? workspaceId : null, {
    date: localDateYmd(),
    page: 1,
    pageSize: 100,
  });

  return (
    <CreateResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={defaultProjectId ? "Add project task" : "New task"}
      description={
        defaultProjectId
          ? "Create a task in this project and assign one or more people. You can add another after saving."
          : "Add a task. Project and assignee options load in the background."
      }
      className="max-w-2xl"
    >
      <CreateTaskForm
        key={open ? (defaultProjectId ?? "none") : "closed"}
        defaultProjectId={defaultProjectId}
        projects={projects}
        members={members}
        teams={teams}
        stayOpen={Boolean(defaultProjectId)}
        workloadUsers={workload.data?.users ?? []}
        onCancel={() => onOpenChange(false)}
        onCreated={() => onOpenChange(false)}
      />
    </CreateResourceDialog>
  );
}

function CreateTaskForm({
  defaultProjectId,
  projects,
  members,
  teams,
  stayOpen,
  workloadUsers,
  onCancel,
  onCreated,
}: {
  defaultProjectId: string | null;
  projects: ReturnType<typeof useProjects>;
  members: ReturnType<typeof useWorkspaceMembers>;
  teams: ReturnType<typeof useTeams>;
  stayOpen?: boolean;
  workloadUsers: WorkloadUser[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [watcherIds, setWatcherIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<
    "PRIVATE" | "PROJECT" | "WORKSPACE"
  >(defaultProjectId ? "PROJECT" : "WORKSPACE");
  const [createdCount, setCreatedCount] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const createTask = useCreateTask();
  const upload = useUploadFile();
  const memberOptions = (members.data ?? []).map((member) => ({
    userId: member.userId,
    name: member.user.name,
  }));
  const peopleLoading = members.isLoading || teams.isLoading;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await createTask.mutateAsync({
        title,
        description: description.trim() || undefined,
        priority,
        dueDate: fromDateInputValue(dueDate),
        startDate: fromDateInputValue(startDate),
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        projectId: projectId || undefined,
        assigneeId: assigneeIds[0] || undefined,
        assigneeIds: assigneeIds.length ? assigneeIds : undefined,
        collaboratorIds: collaboratorIds.length ? collaboratorIds : undefined,
        watcherIds: watcherIds.length ? watcherIds : undefined,
        visibility,
      });
      for (const file of files) {
        await upload.mutateAsync({
          file,
          attach: { taskId: created.id },
        });
      }
      toast.success("Task created", { description: created.title ?? title });
      if (stayOpen) {
        setTitle("");
        setDescription("");
        setAssigneeIds([]);
        setCollaboratorIds([]);
        setWatcherIds([]);
        setDueDate("");
        setStartDate("");
        setEstimatedHours("");
        setFiles([]);
        setCreatedCount((count) => count + 1);
        return;
      }
      onCreated();
    } catch {
      // Error is shown from the mutation.
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {createdCount > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success-soft px-3 py-2.5 text-sm text-success-soft-foreground animate-fade-in">
          <CircleCheck className="mt-px size-4 shrink-0" aria-hidden />
          <p>
            {createdCount} task{createdCount === 1 ? "" : "s"} added to this
            project. Add another with different people, or done.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Draft the kickoff agenda"
            autoFocus
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="task-description">
            Description <span className="font-normal text-subtle-foreground">(optional)</span>
          </Label>
          <textarea
            id="task-description"
            className={nativeTextareaClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Context, acceptance criteria, links…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-project">Project</Label>
          {projects.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <select
              id="task-project"
              className={nativeSelectClass}
              value={projectId}
              disabled={Boolean(defaultProjectId)}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">No project</option>
              {(projects.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-priority">Priority</Label>
          <select
            id="task-priority"
            className={nativeSelectClass}
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {PRIORITY_LABELS[item] ?? item}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-start">Start date</Label>
          <Input
            id="task-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-hours">Estimated hours</Label>
          <Input
            id="task-hours"
            type="number"
            min={0}
            max={1000}
            step={0.25}
            value={estimatedHours}
            onChange={(event) => setEstimatedHours(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-visibility">Visibility</Label>
          <select
            id="task-visibility"
            className={nativeSelectClass}
            value={visibility}
            onChange={(event) =>
              setVisibility(
                event.target.value as "PRIVATE" | "PROJECT" | "WORKSPACE",
              )
            }
          >
            <option value="PRIVATE">Private</option>
            <option value="PROJECT">Project members</option>
            <option value="WORKSPACE">Workspace members</option>
          </select>
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-5">
        <PeoplePicker
          label="Assignees"
          hint="Person or team responsible for completing the task. The first selected person is primary."
          people={memberOptions}
          teams={teams.data ?? []}
          selectedIds={assigneeIds}
          onChange={setAssigneeIds}
          loading={peopleLoading}
          workloadUsers={workloadUsers}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PeoplePicker
            label="Collaborators"
            hint="People or teams working with the assignee."
            people={memberOptions}
            teams={teams.data ?? []}
            selectedIds={collaboratorIds}
            onChange={setCollaboratorIds}
            loading={peopleLoading}
          />
          <PeoplePicker
            label="Watchers"
            hint="People or teams who receive updates."
            people={memberOptions}
            teams={teams.data ?? []}
            selectedIds={watcherIds}
            onChange={setWatcherIds}
            loading={peopleLoading}
          />
        </div>
      </div>

      <OptionalAttachments
        inputId="task-files"
        files={files}
        onChange={setFiles}
        disabled={createTask.isPending || upload.isPending}
      />
      {createTask.error ? (
        <p className="text-sm text-danger-soft-foreground">{createTask.error.message}</p>
      ) : null}
      {upload.error ? (
        <p className="text-sm text-danger-soft-foreground">{upload.error.message}</p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {stayOpen && createdCount > 0 ? "Done" : "Cancel"}
        </Button>
        <Button
          type="submit"
          disabled={!title.trim()}
          loading={createTask.isPending || upload.isPending}
        >
          <Plus />
          {stayOpen ? "Add task" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
