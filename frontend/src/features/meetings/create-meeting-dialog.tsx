"use client";

import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { toast } from "@/components/ui/toast";
import { useProjects } from "@/features/projects/hooks";
import { useTeams } from "@/features/collaboration/hooks";
import { useCreateMeeting } from "@/features/meetings/hooks";
import {
  emptyMeetingForm,
  MeetingForm,
  toMeetingWriteInput,
} from "@/features/meetings/meeting-form";
import { useWorkspaceMembers } from "@/features/workspaces/hooks";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

type CreateMeetingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateMeetingDialog({
  open,
  onOpenChange,
}: CreateMeetingDialogProps) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const projects = useProjects(workspaceId, false, open);
  const members = useWorkspaceMembers(workspaceId, open);
  const teams = useTeams(open ? workspaceId : null);
  const createMeeting = useCreateMeeting();
  const meetingProjectId = useUiStore((state) => state.createMeetingProjectId);
  const initial = {
    ...emptyMeetingForm(),
    projectId: meetingProjectId ?? "",
  };

  return (
    <CreateResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule meeting"
      description="Pick a time, a place and who should be there."
      className="max-w-2xl"
    >
      <MeetingForm
        key={open ? `open-${meetingProjectId ?? "none"}` : "closed"}
        initial={initial}
        projects={projects}
        members={members}
        teams={teams}
        submitting={createMeeting.isPending}
        submitLabel="Schedule meeting"
        error={createMeeting.error?.message}
        onSubmit={async (values) => {
          try {
            await createMeeting.mutateAsync(toMeetingWriteInput(values));
            toast.success("Meeting scheduled");
            onOpenChange(false);
          } catch {
            // Error is shown from the mutation.
          }
        }}
      />
    </CreateResourceDialog>
  );
}
