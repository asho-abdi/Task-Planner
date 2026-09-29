"use client";

import { useMemo, useRef, useState } from "react";
import {
  Download,
  Ellipsis,
  Eye,
  File as FileIcon,
  FileArchive,
  FileCode,
  FileImage,
  FileMusic,
  FilePlay,
  FileSpreadsheet,
  FileText,
  FolderInput,
  FolderOpen,
  LayoutGrid,
  List,
  Pencil,
  Presentation,
  Search,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  EmptyState,
  ListPanel,
  PageHeader,
  PageShell,
  SegmentedControl,
} from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
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
import { cn, formatDate, formatDateTime, nativeSelectClass } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/store/workspace-store";

type ViewMode = "grid" | "list";

function fileType(file: WorkspaceFile) {
  if (file.mimeType.startsWith("image/")) return "Image";
  if (file.mimeType.includes("pdf") || file.originalName.toLowerCase().endsWith(".pdf")) {
    return "PDF";
  }
  const ext = file.originalName.split(".").pop();
  return ext ? ext.toUpperCase() : "File";
}

function extensionOf(file: WorkspaceFile) {
  const parts = file.originalName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

type KindMeta = { icon: LucideIcon; tone: string; label: string };

const KINDS: Record<string, KindMeta> = {
  image: { icon: FileImage, tone: "bg-info-soft text-info-soft-foreground", label: "Image" },
  pdf: { icon: FileText, tone: "bg-danger-soft text-danger-soft-foreground", label: "PDF" },
  doc: { icon: FileText, tone: "bg-primary-soft text-primary-soft-foreground", label: "Document" },
  sheet: { icon: FileSpreadsheet, tone: "bg-success-soft text-success-soft-foreground", label: "Spreadsheet" },
  slides: { icon: Presentation, tone: "bg-warning-soft text-warning-soft-foreground", label: "Presentation" },
  archive: { icon: FileArchive, tone: "bg-warning-soft text-warning-soft-foreground", label: "Archive" },
  video: { icon: FilePlay, tone: "bg-info-soft text-info-soft-foreground", label: "Video" },
  audio: { icon: FileMusic, tone: "bg-primary-soft text-primary-soft-foreground", label: "Audio" },
  code: { icon: FileCode, tone: "bg-secondary text-secondary-foreground", label: "Code" },
  other: { icon: FileIcon, tone: "bg-muted text-muted-foreground", label: "File" },
};

function fileKind(file: WorkspaceFile): KindMeta {
  const mime = file.mimeType.toLowerCase();
  const ext = extensionOf(file);
  if (mime.startsWith("image/")) return KINDS.image;
  if (mime.includes("pdf") || ext === "pdf") return KINDS.pdf;
  if (mime.startsWith("video/")) return KINDS.video;
  if (mime.startsWith("audio/")) return KINDS.audio;
  if (["xls", "xlsx", "csv", "ods", "numbers"].includes(ext) || mime.includes("spreadsheet") || mime.includes("csv")) {
    return KINDS.sheet;
  }
  if (["ppt", "pptx", "key", "odp"].includes(ext) || mime.includes("presentation")) return KINDS.slides;
  if (["zip", "rar", "7z", "tar", "gz", "tgz"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) {
    return KINDS.archive;
  }
  if (["doc", "docx", "odt", "rtf", "txt", "md"].includes(ext) || mime.includes("word") || mime.startsWith("text/plain")) {
    return KINDS.doc;
  }
  if (["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "sql", "xml", "yml", "yaml"].includes(ext)) {
    return KINDS.code;
  }
  return KINDS.other;
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

type FileActions = {
  canWrite: boolean;
  onPreview: (file: WorkspaceFile) => void;
  onDownload: (file: WorkspaceFile) => void;
  onRename: (file: WorkspaceFile) => void;
  onMove: (file: WorkspaceFile) => void;
  onDelete: (file: WorkspaceFile) => void;
};

export default function FilesPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const files = useFiles(workspaceId);
  const upload = useUploadFile();
  const rename = useRenameFile();
  const move = useMoveFile();
  const queryClient = useQueryClient();
  const canWrite = Boolean(workspace && workspace.role !== "VIEWER");
  const [preview, setPreview] = useState<{ id: string; name: string; url: string; mime: string } | null>(null);
  const [renaming, setRenaming] = useState<WorkspaceFile | null>(null);
  const [moving, setMoving] = useState<WorkspaceFile | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceFile | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const fileInput = useRef<HTMLInputElement>(null);

  const allFiles = useMemo(() => files.data ?? [], [files.data]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allFiles;
    return allFiles.filter(
      (file) =>
        file.originalName.toLowerCase().includes(needle) ||
        (file.uploadedBy?.name ?? "").toLowerCase().includes(needle) ||
        attachedTo(file).toLowerCase().includes(needle),
    );
  }, [allFiles, query]);

  const actions: FileActions = {
    canWrite,
    onPreview: (file) => {
      void previewFileUrl(file.id)
        .then((url) =>
          setPreview({
            id: file.id,
            name: file.originalName,
            url,
            mime: file.mimeType,
          }),
        )
        .catch(() => toast.error("Could not load the preview"));
    },
    onDownload: (file) => {
      void downloadFile(file.id, file.originalName).catch(() =>
        toast.error("Could not download the file"),
      );
    },
    onRename: (file) => {
      setRenaming(file);
      setName(file.originalName);
    },
    onMove: (file) => setMoving(file),
    onDelete: (file) => setDeleting(file),
  };

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await deleteFile(deleting.id);
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: ["files", workspaceId],
        });
      }
      toast.success(`${deleting.originalName} deleted`);
      setDeleting(null);
    } catch {
      toast.error("Could not delete the file");
    } finally {
      setDeletePending(false);
    }
  }

  const uploadButton = canWrite ? (
    <Button
      onClick={() => fileInput.current?.click()}
      loading={upload.isPending}
    >
      {upload.isPending ? null : <Upload />}
      {upload.isPending ? "Uploading…" : "Upload"}
    </Button>
  ) : null;

  return (
    <PageShell width="wide">
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload
              .mutateAsync({ file })
              .then(() => toast.success(`${file.name} uploaded`))
              .catch(() => undefined);
          }
          event.target.value = "";
        }}
      />
      <PageHeader
        title="Files"
        icon={FolderOpen}
        description="Attached across tasks, projects, meetings, and chat."
        meta={
          files.data?.length ? (
            <span className="tabular">
              {files.data.length} {files.data.length === 1 ? "file" : "files"} ·{" "}
              {formatSize(files.data.reduce((sum, file) => sum + file.sizeBytes, 0))}
            </span>
          ) : null
        }
        actions={uploadButton}
      />

      {upload.isError ? (
        <ErrorState title="Upload failed" description={upload.error.message} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files"
            aria-label="Search files"
            className="pl-8"
          />
        </div>
        <SegmentedControl
          label="View"
          className="self-start sm:self-auto"
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: "Grid", icon: <LayoutGrid className="size-3.5" /> },
            { value: "list", label: "List", icon: <List className="size-3.5" /> },
          ]}
        />
      </div>

      {files.isLoading ? (
        view === "grid" ? (
          <FileGridSkeleton />
        ) : (
          <ListPanel>
            <div role="status" aria-label="Loading files" className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="ml-auto h-3 w-16" />
                </div>
              ))}
            </div>
          </ListPanel>
        )
      ) : files.isError ? (
        <ErrorState
          title="Couldn't load files"
          description={files.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void files.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !allFiles.length ? (
        <ListPanel>
          <EmptyState
            icon={Upload}
            title="No files yet"
            description="Upload a file to this workspace."
            action={uploadButton}
          />
        </ListPanel>
      ) : !visible.length ? (
        <ListPanel>
          <EmptyState
            compact
            icon={Search}
            title="No matching files"
            description={`Nothing matches “${query.trim()}”.`}
            action={
              <Button size="sm" variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        </ListPanel>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map((file) => (
            <FileCard key={file.id} file={file} actions={actions} />
          ))}
        </div>
      ) : (
        <ListPanel>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploader</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Attached to</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((file) => {
                const kind = fileKind(file);
                const Icon = kind.icon;
                return (
                  <TableRow key={file.id} className="group">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => actions.onPreview(file)}
                        className="flex max-w-[280px] items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={file.originalName}
                      >
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", kind.tone)}>
                          <Icon className="size-4" />
                        </span>
                        <span className="truncate font-medium text-foreground hover:underline">
                          {file.originalName}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fileType(file)}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{formatSize(file.sizeBytes)}</TableCell>
                    <TableCell>
                      {file.uploadedBy ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Avatar name={file.uploadedBy.name} size="xs" />
                          <span className="truncate">{file.uploadedBy.name}</span>
                        </span>
                      ) : (
                        <span className="text-subtle-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground" title={formatDateTime(file.createdAt)}>
                      {formatDate(file.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{attachedTo(file)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Tooltip content="Download">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Download ${file.originalName}`}
                            onClick={() => actions.onDownload(file)}
                          >
                            <Download />
                          </Button>
                        </Tooltip>
                        <FileMenu file={file} actions={actions} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
            <DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview?.mime.startsWith("image/") ? (
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full object-contain" />
            </div>
          ) : preview?.mime.includes("pdf") ? (
            <iframe title={preview.name} src={preview.url} className="h-[70vh] w-full rounded-lg border border-border" />
          ) : (
            <EmptyState
              compact
              icon={FileIcon}
              title="No preview available"
              description="Preview is not available for this file type. Download it instead."
            />
          )}
          {preview ? (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  void downloadFile(preview.id, preview.name).catch(() =>
                    toast.error("Could not download the file"),
                  );
                }}
              >
                <Download />
                Download
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>Give this file a clearer name.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!renaming) return;
              await rename.mutateAsync({ fileId: renaming.id, originalName: name });
              toast.success("File renamed");
              setRenaming(null);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="file-name">File name</Label>
              <Input
                id="file-name"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()} loading={rename.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleting?.originalName}</span> will be
              permanently removed from this workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deletePending}>
              Cancel
            </Button>
            <Button variant="destructive" loading={deletePending} onClick={() => void confirmDelete()}>
              Delete file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {moving ? (
        <MoveFileDialog
          file={moving}
          pending={move.isPending}
          onClose={() => setMoving(null)}
          onMove={async (attach) => {
            await move.mutateAsync({ fileId: moving.id, attach });
            toast.success("File moved");
            setMoving(null);
          }}
        />
      ) : null}
    </PageShell>
  );
}

function FileMenu({
  file,
  actions,
  className,
}: {
  file: WorkspaceFile;
  actions: FileActions;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={className}
          aria-label={`More actions for ${file.originalName}`}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => actions.onPreview(file)}>
          <Eye />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.onDownload(file)}>
          <Download />
          Download
        </DropdownMenuItem>
        {actions.canWrite ? (
          <>
            <DropdownMenuItem onSelect={() => actions.onRename(file)}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onMove(file)}>
              <FolderInput />
              Move
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(file)}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FileCard({ file, actions }: { file: WorkspaceFile; actions: FileActions }) {
  const kind = fileKind(file);
  const Icon = kind.icon;
  const ext = extensionOf(file);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[box-shadow,border-color] duration-150 hover:border-border-strong hover:shadow-md">
      <button
        type="button"
        onClick={() => actions.onPreview(file)}
        aria-label={`Preview ${file.originalName}`}
        className={cn(
          "relative flex h-24 items-center justify-center sm:h-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          kind.tone,
        )}
      >
        <Icon className="size-9" strokeWidth={1.5} />
        {ext ? (
          <span className="absolute bottom-2 left-2 rounded-sm bg-card/80 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-foreground">
            {ext}
          </span>
        ) : null}
      </button>
      <div className="pointer-events-none absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        <Tooltip content="Preview">
          <Button
            variant="outline"
            size="icon-xs"
            className="bg-card shadow-sm"
            aria-label={`Preview ${file.originalName}`}
            onClick={() => actions.onPreview(file)}
          >
            <Eye />
          </Button>
        </Tooltip>
        <Tooltip content="Download">
          <Button
            variant="outline"
            size="icon-xs"
            className="bg-card shadow-sm"
            aria-label={`Download ${file.originalName}`}
            onClick={() => actions.onDownload(file)}
          >
            <Download />
          </Button>
        </Tooltip>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-foreground" title={file.originalName}>
              {file.originalName}
            </p>
            <p className="tabular text-xs text-muted-foreground">
              {formatSize(file.sizeBytes)} · {kind.label}
            </p>
          </div>
          <FileMenu file={file} actions={actions} className="-mr-1 -mt-0.5" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5" title={file.uploadedBy?.name}>
            {file.uploadedBy ? <Avatar name={file.uploadedBy.name} size="xs" /> : null}
            <span className="truncate" title={formatDateTime(file.createdAt)}>
              {formatDate(file.createdAt)}
            </span>
          </span>
          <Badge variant="outline" className="hidden shrink-0 min-[480px]:inline-flex">
            {attachedTo(file)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function FileGridSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading files"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="h-24 rounded-none sm:h-28" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
            <div className="flex justify-between pt-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MoveFileDialog({
  file,
  pending,
  onClose,
  onMove,
}: {
  file: WorkspaceFile;
  pending?: boolean;
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
          <DialogTitle className="truncate pr-8">Move {file.originalName}</DialogTitle>
          <DialogDescription>Attach this file somewhere else in the workspace.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
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
          <div className="space-y-2">
            <Label htmlFor="move-kind">Destination type</Label>
            <select
              id="move-kind"
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
          </div>
          {kind !== "workspace" ? (
            <div className="space-y-2">
              <Label htmlFor="move-target">Destination</Label>
              <select
                id="move-target"
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
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={kind !== "workspace" && !targetId}
              loading={pending}
            >
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
