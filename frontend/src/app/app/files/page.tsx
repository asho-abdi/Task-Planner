"use client";

import { useMemo, useState } from "react";
import { EmptyState, ListPanel, PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConversations } from "@/features/chat/hooks";
import {
  deleteFile,
  downloadFile,
  previewFileUrl,
} from "@/features/collaboration/api";
import {
  useFiles,
  useMoveFile,
  usePages,
  useRenameFile,
  useTeams,
  useUploadFile,
} from "@/features/collaboration/hooks";
import type { FileAttach, WorkspaceFile } from "@/features/collaboration/types";
import { useMeetings } from "@/features/meetings/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useTasks } from "@/features/tasks/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { formatDate, nativeSelectClass } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/store/workspace-store";

function fileType(file: WorkspaceFile) {
  if (file.mimeType.startsWith("image/")) return "Image";
  if (file.mimeType.includes("pdf") || file.originalName.toLowerCase().endsWith(".pdf")) {
    return "PDF";
  }
  const ext = file.originalName.split(".").pop();
  return ext ? ext.toUpperCase() : "File";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachedTo(file: WorkspaceFile) {
  if (file.taskId) return "Task";
  if (file.projectId) return "Project";
  if (file.meetingId) return "Meeting";
  if (file.teamId) return "Team";
  if (file.pageId) return "Page";
  if (file.conversationId || file.messageId) return "Chat";
  if (file.commentId) return "Task";
  return "Workspace";
}

export default function FilesPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const files = useFiles(workspaceId);
  const upload = useUploadFile();
  const rename = useRenameFile();
  const move = useMoveFile();
  const queryClient = useQueryClient();
  const canWrite = workspace && workspace.role !== "VIEWER";
  const [preview, setPreview] = useState<{ id: string; name: string; url: string; mime: string } | null>(null);
  const [renaming, setRenaming] = useState<WorkspaceFile | null>(null);
  const [moving, setMoving] = useState<WorkspaceFile | null>(null);
  const [name, setName] = useState("");

  return (
    <PageShell>
      <PageHeader
        title="Files"
        description="Attached across tasks, projects, meetings, and chat."
        actions={
          canWrite ? (
            <label className="inline-flex">
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload.mutateAsync({ file });
                  event.target.value = "";
                }}
              />
              <Button asChild size="sm">
                <span>{upload.isPending ? "Uploading…" : "Upload"}</span>
              </Button>
            </label>
          ) : null
        }
      />
      {upload.isError ? (
        <p className="text-sm text-destructive">{upload.error.message}</p>
      ) : null}
      {files.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : files.isError ? (
        <p className="text-sm text-destructive">{files.error.message}</p>
      ) : !files.data?.length ? (
        <EmptyState title="No files yet" description="Upload a file to this workspace." />
      ) : (
        <ListPanel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Attached to</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.data.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">{file.originalName}</TableCell>
                  <TableCell className="text-muted-foreground">{fileType(file)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatSize(file.sizeBytes)}</TableCell>
                  <TableCell className="text-muted-foreground">{file.uploadedBy?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(file.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{attachedTo(file)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[12px]">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-primary"
                        onClick={async () => {
                          const url = await previewFileUrl(file.id);
                          setPreview({
                            id: file.id,
                            name: file.originalName,
                            url,
                            mime: file.mimeType,
                          });
                        }}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => void downloadFile(file.id, file.originalName)}
                      >
                        Download
                      </button>
                      {canWrite ? (
                        <>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setRenaming(file);
                              setName(file.originalName);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => setMoving(file)}
                          >
                            Move
                          </button>
                          <button
                            type="button"
                            className="text-danger hover:underline"
                            onClick={async () => {
                              await deleteFile(file.id);
                              if (workspaceId) {
                                void queryClient.invalidateQueries({
                                  queryKey: ["files", workspaceId],
                                });
                              }
                            }}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListPanel>
      )}

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open && preview) {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview?.mime.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full object-contain" />
          ) : preview?.mime.includes("pdf") ? (
            <iframe title={preview.name} src={preview.url} className="h-[70vh] w-full rounded-lg border" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview is not available for this file type. Download it instead.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!renaming) return;
              await rename.mutateAsync({ fileId: renaming.id, originalName: name });
              setRenaming(null);
            }}
          >
            <Input value={name} onChange={(event) => setName(event.target.value)} />
            <div className="flex justify-end">
              <Button type="submit" disabled={!name.trim() || rename.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {moving ? (
        <MoveFileDialog
          file={moving}
          onClose={() => setMoving(null)}
          onMove={async (attach) => {
            await move.mutateAsync({ fileId: moving.id, attach });
            setMoving(null);
          }}
        />
      ) : null}
    </PageShell>
  );
}

function MoveFileDialog({
  file,
  onClose,
  onMove,
}: {
  file: WorkspaceFile;
  onClose: () => void;
  onMove: (attach: FileAttach) => Promise<void>;
}) {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const teams = useTeams(workspaceId);
  const projects = useProjects(workspaceId);
  const tasks = useTasks(workspaceId, { pageSize: 50 });
  const meetings = useMeetings(workspaceId);
  const pages = usePages(workspaceId);
  const chats = useConversations(workspaceId);
  const [kind, setKind] = useState("workspace");
  const [targetId, setTargetId] = useState("");

  const options = useMemo(() => {
    if (kind === "team") return (teams.data ?? []).map((item) => ({ id: item.id, label: item.name }));
    if (kind === "project") return (projects.data ?? []).map((item) => ({ id: item.id, label: item.name }));
    if (kind === "task") return (tasks.data?.items ?? []).map((item) => ({ id: item.id, label: item.title }));
    if (kind === "meeting") return (meetings.data ?? []).map((item) => ({ id: item.id, label: item.title }));
    if (kind === "page") return (pages.data ?? []).map((item) => ({ id: item.id, label: item.title }));
    if (kind === "chat") {
      return (chats.data ?? []).map((item) => ({
        id: item.id,
        label: item.name ? `#${item.name}` : item.project?.name ?? "Conversation",
      }));
    }
    return [];
  }, [chats.data, kind, meetings.data, pages.data, projects.data, tasks.data, teams.data]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {file.originalName}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const attach: FileAttach = {};
            if (kind === "team") attach.teamId = targetId;
            if (kind === "project") attach.projectId = targetId;
            if (kind === "task") attach.taskId = targetId;
            if (kind === "meeting") attach.meetingId = targetId;
            if (kind === "page") attach.pageId = targetId;
            if (kind === "chat") attach.conversationId = targetId;
            await onMove(attach);
          }}
        >
          <select
            className={nativeSelectClass}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setTargetId("");
            }}
          >
            <option value="workspace">Workspace</option>
            <option value="team">Team</option>
            <option value="project">Project</option>
            <option value="task">Task</option>
            <option value="meeting">Meeting</option>
            <option value="page">Page</option>
            <option value="chat">Chat</option>
          </select>
          {kind !== "workspace" ? (
            <select
              className={nativeSelectClass}
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Select</option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={kind !== "workspace" && !targetId}>
              Move
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
