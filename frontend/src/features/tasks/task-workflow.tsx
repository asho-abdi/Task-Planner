"use client";

import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CornerDownRight,
  Download,
  File as FileIcon,
  FileText,
  FileUp,
  ImageIcon,
  Lock,
  MessageSquare,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  SmilePlus,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { CreateResourceDialog } from "@/components/create-resource-dialog";
import {
  collabKeys,
  useAddComment,
  useComments,
  useFiles,
  useReactToComment,
  useTaskWorkflow,
  useUploadFile,
} from "@/features/collaboration/hooks";
import { downloadFile } from "@/features/collaboration/api";
import { useRealtime } from "@/features/chat/realtime-provider";
import type { Task, TaskSubmission } from "@/features/tasks/types";
import {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  nativeTextareaClass,
} from "@/lib/utils";

type WorkflowProps = {
  task: Task;
  userId?: string;
  canWrite: boolean;
  isAdmin: boolean;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(name: string, mime: string) {
  if (mime.startsWith("image/")) return "Image";
  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) return "PDF";
  const ext = name.split(".").pop();
  return ext ? ext.toUpperCase() : "File";
}

function FileTypeIcon({ name, mime }: { name: string; mime: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className="size-4" />;
  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
    return <FileText className="size-4" />;
  }
  return <FileIcon className="size-4" />;
}

function latestSubmissions(task: Task) {
  const seen = new Set<string>();
  const latest: TaskSubmission[] = [];
  for (const item of task.submissions ?? []) {
    if (seen.has(item.submitterId)) continue;
    seen.add(item.submitterId);
    latest.push(item);
  }
  return latest;
}

/** Download row for an attached file. Exported for the task detail page. */
export function FileCard({
  file,
}: {
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
}) {
  return (
    <button
      type="button"
      onClick={() => void downloadFile(file.id, file.originalName)}
      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:border-border-strong hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
        <FileTypeIcon name={file.originalName} mime={file.mimeType} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-foreground">
          {file.originalName}
        </span>
        <span className="block text-xs text-muted-foreground">
          {fileKind(file.originalName, file.mimeType)} · {formatSize(file.sizeBytes)}
        </span>
      </span>
      <Download
        aria-label="Download"
        className="size-4 shrink-0 text-subtle-foreground transition-colors group-hover:text-foreground"
      />
    </button>
  );
}

function useWorkflowContext(
  task: Task,
  userId: string | undefined,
  canWrite: boolean,
  isAdmin: boolean,
) {
  const assignees = task.assignees ?? (task.assignee ? [task.assignee] : []);
  const isAssignee = Boolean(
    userId &&
      (task.ownerId === userId ||
        assignees.some((person) => person.id === userId)),
  );
  const isReviewer = Boolean(
    isAdmin || (userId && task.assignedById === userId),
  );
  const myLatest = (task.submissions ?? []).find(
    (item) => item.submitterId === userId,
  );
  return {
    assignees,
    isAssignee,
    isReviewer,
    canStart:
      canWrite &&
      (isAssignee || isAdmin) &&
      (!task.blocked || isAdmin) &&
      (task.status === "TODO" ||
        task.status === "RETURNED" ||
        task.status === "OVERDUE"),
    canSubmit:
      canWrite &&
      isAssignee &&
      (!task.blocked || isAdmin) &&
      (!myLatest || myLatest.status === "RETURNED") &&
      (task.status === "IN_PROGRESS" ||
        task.status === "RETURNED" ||
        task.status === "OVERDUE" ||
        task.status === "IN_REVIEW" ||
        (task.status === "COMPLETED" && myLatest?.status !== "APPROVED")),
    canReview: canWrite && isReviewer && task.status === "IN_REVIEW",
    myLatest,
  };
}

function activityItems(task: Task) {
  const latest = (task.submissions ?? [])[0];
  const items: Array<{
    label: string;
    at: string | null;
    done: boolean;
  }> = [{ label: "Created", at: task.createdAt, done: true }];

  if (task.startedAt) {
    items.push({ label: "Started", at: task.startedAt, done: true });
  } else if (task.status === "IN_PROGRESS") {
    items.push({ label: "In Progress", at: task.updatedAt, done: true });
  }

  if (latest) {
    items.push({ label: "Submitted", at: latest.createdAt, done: true });
  }

  if (task.status === "IN_REVIEW") {
    items.push({
      label: "Under Review",
      at: latest?.createdAt ?? task.updatedAt,
      done: true,
    });
    items.push({ label: "Awaiting Approval", at: null, done: false });
  }

  if (latest?.status === "APPROVED" || task.status === "COMPLETED") {
    items.push({
      label: task.status === "COMPLETED" ? "Completed" : "Approved",
      at: latest?.reviewedAt ?? task.updatedAt,
      done: true,
    });
  }

  if (latest?.status === "RETURNED" || task.status === "RETURNED") {
    items.push({
      label: "Returned",
      at: latest?.reviewedAt ?? task.updatedAt,
      done: true,
    });
  }

  return items;
}

/** Blocked / returned banners shown above the task content. */
export function TaskNotices({ task }: { task: Task }) {
  const blocker = task.blocked ? (task.blockedBy ?? task.dependsOn)[0] : null;
  if (!blocker && !task.latestReturnComment) return null;
  return (
    <div className="space-y-3">
      {blocker ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-warning-soft-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-base">
            Blocked by <span className="font-medium">“{blocker.title}”</span>
          </p>
        </div>
      ) : null}
      {task.latestReturnComment ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-warning-soft-foreground">
          <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Returned with feedback</p>
            <p className="mt-0.5 whitespace-pre-line text-base">
              {task.latestReturnComment}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Vertical timeline of workflow milestones (created → started → submitted → reviewed). */
export function TaskActivityTimeline({
  task,
  className,
}: {
  task: Task;
  className?: string;
}) {
  const timeline = activityItems(task);
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ol>
          {timeline.map((item, index) => (
            <li key={`${item.label}-${item.at ?? index}`} className="flex gap-3">
              <div className="flex w-3 flex-col items-center">
                <span
                  className={cn(
                    "mt-1 size-2.5 shrink-0 rounded-full",
                    item.done
                      ? "bg-primary ring-4 ring-primary-soft"
                      : "border-2 border-border-strong bg-card",
                  )}
                />
                {index < timeline.length - 1 ? (
                  <span className="my-1 min-h-6 w-px flex-1 bg-border" />
                ) : null}
              </div>
              <div className={cn(index < timeline.length - 1 && "pb-3")}>
                <p
                  className={cn(
                    "text-base font-medium leading-5",
                    item.done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.at ? formatDateTime(item.at) : "Pending"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/**
 * Primary workflow buttons (start / submit / jump to review) plus the submit dialog.
 * Rendered in the task header.
 */
export function TaskWorkActions({
  task,
  userId,
  canWrite,
  isAdmin,
  size = "default",
}: WorkflowProps & { size?: "sm" | "default" }) {
  const workflow = useTaskWorkflow(task.id);
  const files = useFiles(task.workspaceId, { taskId: task.id });
  const upload = useUploadFile();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [justification, setJustification] = useState("");
  const ctx = useWorkflowContext(task, userId, canWrite, isAdmin);

  async function addFiles(list: FileList | File[]) {
    for (const file of Array.from(list)) {
      const created = await upload.mutateAsync({
        file,
        attach: { taskId: task.id },
      });
      if (created?.id) {
        setFileIds((current) =>
          current.includes(created.id) ? current : [...current, created.id],
        );
      }
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await workflow.submit.mutateAsync({
        fileIds,
        note: note.trim() || undefined,
        deliverables: deliverables.trim() || undefined,
        justification: justification.trim() || undefined,
      });
      toast.success("Work submitted for review");
      setSubmitOpen(false);
      setFileIds([]);
      setNote("");
      setDeliverables("");
      setJustification("");
    } catch {
      // Mutation error is shown below.
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) {
      void addFiles(event.dataTransfer.files).catch(() => undefined);
    }
  }

  if (!ctx.canStart && !ctx.canSubmit && !ctx.canReview) return null;

  return (
    <>
      {ctx.canReview ? (
        <Button size={size} variant={ctx.canSubmit || ctx.canStart ? "outline" : "default"} asChild>
          <a href="#task-submissions">
            <Check />
            Review submission
          </a>
        </Button>
      ) : null}
      {ctx.canStart ? (
        <Button
          size={size}
          variant={ctx.canSubmit ? "outline" : "default"}
          onClick={() =>
            workflow.startWork.mutate(undefined, {
              onSuccess: () => toast.success("Work started"),
            })
          }
          loading={workflow.startWork.isPending}
        >
          <Play />
          {task.status === "TODO" ? "Start work" : "Continue work"}
        </Button>
      ) : null}
      {ctx.canSubmit ? (
        <Button size={size} onClick={() => setSubmitOpen(true)}>
          <Send />
          {ctx.myLatest ? "Submit work again" : "Submit work"}
        </Button>
      ) : null}
      {workflow.startWork.error ? (
        <p className="w-full text-sm text-danger-soft-foreground sm:text-right">
          {workflow.startWork.error.message}
        </p>
      ) : null}

      <CreateResourceDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit work"
        description="This sends the task under review. The reviewer will see your uploads next to Approve."
        className="max-w-xl"
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2.5">
            <Label>Deliverable files</Label>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                dragging
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-muted/50 hover:border-primary/40 hover:bg-accent/60",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                <Upload className="size-5" />
              </span>
              <p className="mt-3 text-base font-medium text-foreground">
                Drop files here or click to upload
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional · up to 10MB each
              </p>
              <input
                type="file"
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files?.length) {
                    void addFiles(event.target.files).catch(() => undefined);
                  }
                  event.target.value = "";
                }}
              />
            </label>
            {upload.isPending ? (
              <p className="text-sm text-muted-foreground">Uploading…</p>
            ) : null}
            {upload.error ? (
              <p className="text-sm text-danger-soft-foreground">{upload.error.message}</p>
            ) : null}
            {(files.data ?? []).length ? (
              <ul className="space-y-1.5">
                {(files.data ?? []).map((file) => {
                  const selected = fileIds.includes(file.id);
                  return (
                    <li key={file.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary/40 bg-primary-soft"
                            : "border-border bg-card hover:bg-muted",
                        )}
                        onClick={() =>
                          setFileIds((current) =>
                            selected
                              ? current.filter((id) => id !== file.id)
                              : [...current, file.id],
                          )
                        }
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {selected ? (
                            <Check className="size-4" />
                          ) : (
                            <FileUp className="size-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium text-foreground">
                            {file.originalName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatSize(file.sizeBytes)}
                          </span>
                        </span>
                      </button>
                      <Tooltip content="Download">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Download ${file.originalName}`}
                          onClick={() => void downloadFile(file.id, file.originalName)}
                        >
                          <Download />
                        </Button>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No files yet. You can submit without an attachment.
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="submit-note">Comment</Label>
              <textarea
                id="submit-note"
                className={nativeTextareaClass}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What should the reviewer look at?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliverables">Deliverables</Label>
              <Input
                id="deliverables"
                value={deliverables}
                onChange={(event) => setDeliverables(event.target.value)}
                placeholder="Optional summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="justification">Justification</Label>
              <Input
                id="justification"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          {workflow.submit.error ? (
            <p className="text-sm text-danger-soft-foreground">
              {workflow.submit.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={workflow.submit.isPending}
              disabled={upload.isPending}
            >
              <Send />
              Submit for review
            </Button>
          </div>
        </form>
      </CreateResourceDialog>
    </>
  );
}

/** Notices, activity timeline and workflow buttons in one block. */
export function TaskWorkPanel(props: WorkflowProps) {
  return (
    <div className="space-y-4">
      <TaskNotices task={props.task} />
      <TaskActivityTimeline task={props.task} />
      <div className="flex flex-wrap gap-2">
        <TaskWorkActions {...props} />
      </div>
    </div>
  );
}

function FieldBlock({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 whitespace-pre-line text-base leading-relaxed",
          value ? "text-foreground" : "text-subtle-foreground",
        )}
      >
        {value || empty}
      </p>
    </div>
  );
}

export function TaskReviewPanel({
  task,
  userId,
  canWrite,
  isAdmin,
}: WorkflowProps) {
  const workflow = useTaskWorkflow(task.id);
  const [returnOpen, setReturnOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const ctx = useWorkflowContext(task, userId, canWrite, isAdmin);
  const versions = useMemo(
    () =>
      [...(task.submissions ?? [])].sort((a, b) => b.version - a.version),
    [task.submissions],
  );
  const latest = latestSubmissions(task);
  const [selectedId, setSelectedId] = useState(versions[0]?.id);
  const selected =
    versions.find((item) => item.id === selectedId) ?? versions[0] ?? null;
  const pending = latest.filter((item) => item.status === "SUBMITTED");
  const returnTarget =
    selected?.status === "SUBMITTED" ? selected : pending[0];
  const remainingAssignees = (task.assigneeWork ?? []).filter(
    (person) =>
      person.status !== "APPROVED" &&
      person.userId !== selected?.submitterId,
  ).length;

  return (
    <>
      <Card id="task-submissions" className="scroll-mt-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Submissions</CardTitle>
              <CardDescription>
                Each assignee submits their own work. The task completes when every assignee is approved.
              </CardDescription>
            </div>
            {versions.length ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">
                {versions.length} version{versions.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {ctx.canReview ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-medium text-primary-soft-foreground">
                  Awaiting your review
                </p>
                <p className="text-sm text-muted-foreground">
                  Approve the selected version or return it with feedback.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hover:border-danger/40 hover:bg-danger-soft hover:text-danger-soft-foreground"
                  onClick={() => setReturnOpen(true)}
                  disabled={!returnTarget}
                >
                  <RotateCcw />
                  Return with comment
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setApproveOpen(true)}
                  disabled={!selected || selected.status !== "SUBMITTED"}
                >
                  <Check />
                  Approve work
                </Button>
              </div>
            </div>
          ) : null}

          {(task.assigneeWork ?? []).length > 1 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {(task.assigneeWork ?? []).map((person) => (
                <li
                  key={person.userId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={person.name} size="sm" />
                    <span className="truncate text-base font-medium text-foreground">
                      {person.name}
                    </span>
                  </span>
                  <StatusBadge value={person.status} />
                </li>
              ))}
            </ul>
          ) : null}

          {versions.length > 1 ? (
            <div
              role="radiogroup"
              aria-label="Submission version"
              className="flex gap-2 overflow-x-auto pb-1"
            >
              {versions.map((item) => {
                const active = item.id === selected?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/40 bg-primary-soft"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        v{item.version} · {item.submitter.name.split(" ")[0]}
                      </span>
                      <StatusBadge value={item.status} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!selected ? (
            <EmptyState
              compact
              icon={FileUp}
              title="No work submitted yet"
              description="Assignee uploads and notes will appear here after they submit."
              className="rounded-lg border border-dashed border-border"
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-muted/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={selected.submitter.name} size="default" />
                  <div>
                    <p className="text-base font-medium text-foreground">
                      {selected.submitter.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDateTime(selected.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Version {selected.version}
                  </span>
                  <StatusBadge value={selected.status} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldBlock label="Submission notes" value={selected.note} empty="No notes were added." />
                </div>
                <FieldBlock label="Deliverables" value={selected.deliverables} empty="No deliverables summary." />
                <FieldBlock label="Justification" value={selected.justification} empty="No justification provided." />
              </div>
              {selected.reviewNote ? (
                <div className="rounded-lg border-l-2 border-warning bg-warning-soft/60 px-4 py-3">
                  <p className="text-xs font-medium text-warning-soft-foreground">
                    Reviewer comment
                  </p>
                  <p className="mt-1 whitespace-pre-line text-base text-foreground">
                    {selected.reviewNote}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Submitted files
                </p>
                {(selected.files ?? []).length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(selected.files ?? []).map((file) => (
                      <FileCard key={file.id} file={file} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-subtle-foreground">
                    This submission was sent without an upload.
                  </p>
                )}
              </div>
            </div>
          )}

          {workflow.review.error ? (
            <p className="text-sm text-danger-soft-foreground">
              {workflow.review.error.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <CreateResourceDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve Submission?"
        description={
          selected
            ? remainingAssignees > 0
              ? `You are about to approve work from ${selected.submitter.name}. ${remainingAssignees} other assignee${remainingAssignees === 1 ? " still needs" : "s still need"} to finish before this task is completed.`
              : `You are about to approve Version ${selected.version} submitted by ${selected.submitter.name}. After approval, this task will be marked completed.`
            : "Approve this submission."
        }
      >
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setApproveOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected}
            loading={workflow.review.isPending}
            onClick={() => {
              if (!selected) return;
              workflow.review.mutate(
                { status: "APPROVED", submissionId: selected.id },
                {
                  onSuccess: () => {
                    toast.success("Submission approved");
                    setApproveOpen(false);
                  },
                },
              );
            }}
          >
            <Check />
            Approve work
          </Button>
        </div>
      </CreateResourceDialog>

      <CreateResourceDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        title="Return Submission"
        description="Tell the assignee what needs to be changed."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            workflow.review.mutate(
              {
                status: "RETURNED",
                note: returnNote.trim(),
                submissionId: returnTarget?.id,
              },
              {
                onSuccess: () => {
                  toast.success("Submission returned with feedback");
                  setReturnOpen(false);
                  setReturnNote("");
                },
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="return-note">Feedback</Label>
            <textarea
              id="return-note"
              className={cn(nativeTextareaClass, "min-h-36")}
              rows={6}
              value={returnNote}
              onChange={(event) => setReturnNote(event.target.value)}
              placeholder="Add your feedback..."
              autoFocus
            />
          </div>
          {workflow.review.error ? (
            <p className="text-sm text-danger-soft-foreground">
              {workflow.review.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReturnOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!returnNote.trim()}
              loading={workflow.review.isPending}
            >
              <RotateCcw />
              Return submission
            </Button>
          </div>
        </form>
      </CreateResourceDialog>
    </>
  );
}

export function TaskCommentsSection({
  workspaceId,
  taskId,
  canWrite,
}: {
  workspaceId: string;
  taskId: string;
  canWrite: boolean;
}) {
  const comments = useComments(workspaceId, taskId);
  const addComment = useAddComment(taskId);
  const react = useReactToComment(taskId);
  const upload = useUploadFile();
  const queryClient = useQueryClient();
  const { joinTask, leaveTask } = useRealtime();
  const [body, setBody] = useState("");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    joinTask(taskId);
    return () => leaveTask(taskId);
  }, [joinTask, leaveTask, taskId]);

  const all = comments.data ?? [];
  const roots = all.filter((item) => !item.parentId);
  const repliesOf = (id: string) => all.filter((item) => item.parentId === id);
  const replyingTo = replyId ? all.find((item) => item.id === replyId) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    const created = await addComment.mutateAsync({
      body: body.trim(),
      parentId: replyId ?? undefined,
    });
    for (const file of pendingFiles) {
      await upload.mutateAsync({
        file,
        attach: { taskId, commentId: created.id },
      });
    }
    void queryClient.invalidateQueries({
      queryKey: collabKeys.comments(workspaceId, taskId),
    });
    toast.success(replyId ? "Reply posted" : "Comment posted");
    setBody("");
    setReplyId(null);
    setPendingFiles([]);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Comments</CardTitle>
          {all.length ? (
            <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular">
              {all.length}
            </span>
          ) : null}
        </div>
        <CardDescription>
          Mentions, replies, reactions, and files stay on the task.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {comments.isLoading ? (
          <SkeletonList rows={2} className="-mx-4" />
        ) : all.length ? (
          <ul className="space-y-5">
            {roots.map((item) => (
              <li key={item.id}>
                <CommentBody
                  item={item}
                  canWrite={canWrite}
                  onReply={() => setReplyId(item.id)}
                  onReact={(emoji) =>
                    void react
                      .mutateAsync({ commentId: item.id, emoji })
                      .catch(() => undefined)
                  }
                />
                {repliesOf(item.id).length ? (
                  <ul className="ml-4 mt-3 space-y-3 border-l-2 border-border pl-4 sm:ml-11">
                    {repliesOf(item.id).map((reply) => (
                      <li key={reply.id}>
                        <CommentBody
                          item={reply}
                          compact
                          canWrite={canWrite}
                          onReply={() => setReplyId(reply.id)}
                          onReact={(emoji) =>
                            void react
                              .mutateAsync({ commentId: reply.id, emoji })
                              .catch(() => undefined)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={MessageSquare}
            title="No comments yet"
            description="Add a note for the assignee or reviewer."
          />
        )}
        {canWrite ? (
          <form
            className="rounded-xl border border-border bg-card shadow-xs transition-shadow focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
            onSubmit={(event) => void submit(event).catch(() => undefined)}
          >
            {replyingTo || replyId ? (
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
                <CornerDownRight className="size-3.5" aria-hidden />
                Replying to{" "}
                <span className="font-medium text-foreground">
                  {replyingTo?.author.name ?? "comment"}
                </span>
                <button
                  type="button"
                  aria-label="Cancel reply"
                  className="ml-auto inline-flex size-5 items-center justify-center rounded-sm hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setReplyId(null)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
            <textarea
              aria-label="Comment"
              className="block min-h-20 w-full resize-y rounded-t-xl bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-subtle-foreground focus:outline-none"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a comment. Use @name to mention."
            />
            {pendingFiles.length ? (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {pendingFiles.map((file) => (
                  <span
                    key={`${file.name}-${file.size}`}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <Paperclip className="size-3" aria-hidden />
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
              <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                <Paperclip className="size-3.5" aria-hidden />
                Attach
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(event) =>
                    setPendingFiles(Array.from(event.target.files ?? []))
                  }
                />
              </label>
              <Button
                type="submit"
                size="sm"
                disabled={!body.trim()}
                loading={addComment.isPending || upload.isPending}
              >
                <Send />
                {replyId ? "Reply" : "Comment"}
              </Button>
            </div>
            {addComment.error ? (
              <p className="px-3 pb-2 text-sm text-danger-soft-foreground">
                {addComment.error.message}
              </p>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CommentBody({
  item,
  canWrite,
  compact,
  onReply,
  onReact,
}: {
  item: {
    id: string;
    body: string;
    createdAt: string;
    author: { name: string };
    reactions?: Array<{ emoji: string; count: number }>;
    files?: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  };
  canWrite: boolean;
  compact?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
}) {
  const parts = item.body.split(/(@[\w.\-]+)/g);
  return (
    <div className="flex gap-3">
      <Avatar name={item.author.name} size={compact ? "sm" : "default"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-base font-medium text-foreground">{item.author.name}</p>
          <time
            dateTime={item.createdAt}
            title={formatDateTime(item.createdAt)}
            className="text-xs text-subtle-foreground"
          >
            {formatRelativeTime(item.createdAt)}
          </time>
        </div>
        <div className="mt-1 inline-block max-w-full rounded-lg rounded-tl-sm bg-muted px-3 py-2">
          <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground">
            {parts.map((part, index) =>
              part.startsWith("@") ? (
                <span
                  key={`${part}-${index}`}
                  className="rounded-sm bg-primary-soft px-0.5 font-medium text-primary-soft-foreground"
                >
                  {part}
                </span>
              ) : (
                <span key={`${part}-${index}`}>{part}</span>
              ),
            )}
          </p>
          {(item.files ?? []).length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(item.files ?? []).map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void downloadFile(file.id, file.originalName)}
                >
                  <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{file.originalName}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {(item.reactions ?? []).map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              aria-label={`React ${reaction.emoji} (${reaction.count})`}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-xs text-foreground tabular transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onReact(reaction.emoji)}
            >
              {reaction.emoji} {reaction.count}
            </button>
          ))}
          {canWrite ? (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full px-1 text-subtle-foreground">
                <SmilePlus className="size-3.5" aria-hidden />
                {["👍", "🎉", "✅"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`React with ${emoji}`}
                    className="inline-flex size-6 items-center justify-center rounded-full text-xs opacity-70 transition-[opacity,background-color] hover:bg-muted hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onReact(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </span>
              <button
                type="button"
                className="inline-flex h-6 items-center rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onReply}
              >
                Reply
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TaskWorkflowPanel(props: WorkflowProps) {
  return (
    <>
      <TaskReviewPanel {...props} />
      <TaskWorkPanel {...props} />
    </>
  );
}
