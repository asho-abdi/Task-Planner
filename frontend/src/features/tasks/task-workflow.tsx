"use client";

import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  File as FileIcon,
  FileText,
  FileUp,
  ImageIcon,
  RotateCcw,
  Upload,
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
import { StatusBadge } from "@/components/ui/badge";
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
  nativeTextareaClass,
} from "@/lib/utils";

const workspaceCard =
  "rounded-2xl border-border shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

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
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
    return <FileText className="h-4 w-4" />;
  }
  return <FileIcon className="h-4 w-4" />;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

function FileCard({
  file,
}: {
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:bg-muted">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <FileTypeIcon name={file.originalName} mime={file.mimeType} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {file.originalName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fileKind(file.originalName, file.mimeType)} · {formatSize(file.sizeBytes)}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
        onClick={() => void downloadFile(file.id, file.originalName)}
      >
        Download
      </button>
    </div>
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

export function TaskWorkPanel({
  task,
  userId,
  canWrite,
  isAdmin,
}: {
  task: Task;
  userId?: string;
  canWrite: boolean;
  isAdmin: boolean;
}) {
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
  const timeline = activityItems(task);

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
      void addFiles(event.dataTransfer.files);
    }
  }

  return (
    <>
      <Card className={workspaceCard}>
        <CardHeader>
          <CardTitle className="text-[18px]">Work Activity</CardTitle>
          <CardDescription>
            Start work, then submit. Submitting puts this under review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {task.blocked && (task.blockedBy ?? task.dependsOn)[0] ? (
            <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
              🔒 Blocked by “{(task.blockedBy ?? task.dependsOn)[0].title}”
            </div>
          ) : null}
          {task.latestReturnComment ? (
            <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
              <p className="text-xs font-medium uppercase tracking-wide text-warning-soft-foreground">
                Returned
              </p>
              <p className="mt-1">{task.latestReturnComment}</p>
            </div>
          ) : null}
          <ol className="space-y-0">
            {timeline.map((item, index) => (
              <li key={`${item.label}-${item.at ?? index}`} className="flex gap-3">
                <div className="flex w-4 flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 rounded-full",
                      item.done ? "bg-primary" : "border-2 border-border-strong bg-card",
                    )}
                  />
                  {index < timeline.length - 1 ? (
                    <span className="min-h-8 w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <div className="pb-5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      item.done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.at ? formatDateTime(item.at) : "Pending"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {ctx.canStart || ctx.canSubmit ? (
            <div className="flex flex-wrap gap-2">
              {ctx.canStart ? (
                <Button
                  onClick={() => workflow.startWork.mutate()}
                  disabled={workflow.startWork.isPending}
                >
                  {task.status === "TODO" ? "Start work" : "Continue work"}
                </Button>
              ) : null}
              {ctx.canSubmit ? (
                <Button onClick={() => setSubmitOpen(true)}>
                  {ctx.myLatest ? "Submit work again" : "Submit work"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {workflow.startWork.error ? (
            <p className="text-sm text-destructive">
              {workflow.startWork.error.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <CreateResourceDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit work"
        description="This sends the task under review. The reviewer will see your uploads next to Approve."
        className="max-w-xl"
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <Label>Deliverable files</Label>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                dragging
                  ? "border-primary bg-accent"
                  : "border-border bg-secondary/60 hover:border-primary/40 hover:bg-accent/60",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-medium">
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
                    void addFiles(event.target.files);
                  }
                  event.target.value = "";
                }}
              />
            </label>
            {upload.isPending ? (
              <p className="text-sm text-muted-foreground">Uploading…</p>
            ) : null}
            {upload.error ? (
              <p className="text-sm text-destructive">{upload.error.message}</p>
            ) : null}
            {(files.data ?? []).length ? (
              <ul className="space-y-2">
                {(files.data ?? []).map((file) => {
                  const selected = fileIds.includes(file.id);
                  return (
                    <li key={file.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "border-primary/40 bg-accent"
                            : "border-border bg-card hover:bg-secondary",
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
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {selected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <FileUp className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {file.originalName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatSize(file.sizeBytes)}
                          </span>
                        </span>
                        <span
                          role="link"
                          tabIndex={0}
                          className="text-xs text-primary hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void downloadFile(file.id, file.originalName);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.stopPropagation();
                              void downloadFile(file.id, file.originalName);
                            }
                          }}
                        >
                          Download
                        </span>
                      </button>
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
            <p className="text-sm text-destructive">
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
              disabled={workflow.submit.isPending || upload.isPending}
            >
              {workflow.submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </form>
      </CreateResourceDialog>
    </>
  );
}

export function TaskReviewPanel({
  task,
  userId,
  canWrite,
  isAdmin,
}: {
  task: Task;
  userId?: string;
  canWrite: boolean;
  isAdmin: boolean;
}) {
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
      <Card className={workspaceCard}>
        <CardHeader>
          <CardTitle className="text-[18px]">Work Submission</CardTitle>
          <CardDescription>
            Each assignee submits their own work. The task is completed only when every assignee is approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(task.assigneeWork ?? []).length > 1 ? (
            <ul className="space-y-2 rounded-xl border border-border px-3.5 py-3">
              {(task.assigneeWork ?? []).map((person) => (
                <li
                  key={person.userId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-foreground">{person.name}</span>
                  <StatusBadge value={person.status} />
                </li>
              ))}
            </ul>
          ) : null}
          {versions.length > 1 ? (
            <div className="space-y-2">
              {versions.map((item) => {
                const active = item.id === selected?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary/30 bg-primary-soft"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">Version {item.version}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <StatusBadge value={item.status} />
                  </button>
                );
              })}
            </div>
          ) : null}

          {!selected ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No work has been submitted yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Assignee uploads and notes will appear here after submit.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    Submitted by
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selected.submitter.name}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    Version
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    Version {selected.version}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    Submitted
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {formatDateTime(selected.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Submission Notes
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selected.note || "No notes were added."}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Deliverables
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selected.deliverables || "No deliverables summary."}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Justification
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {selected.justification || "No justification provided."}
                  </p>
                </div>
                {selected.reviewNote ? (
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">
                      Reviewer comment
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {selected.reviewNote}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Submitted files
                </p>
                {(selected.files ?? []).length ? (
                  <div className="space-y-2">
                    {(selected.files ?? []).map((file) => (
                      <FileCard key={file.id} file={file} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
                    <p className="text-sm font-medium text-foreground">
                      No files attached
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This submission was sent without an upload.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {ctx.canReview ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-foreground">
                Review complete?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-danger/30 text-danger-soft-foreground hover:bg-danger-soft hover:text-danger-soft-foreground"
                  onClick={() => setReturnOpen(true)}
                  disabled={!returnTarget}
                >
                  <RotateCcw />
                  Return with Comment
                </Button>
                <Button
                  type="button"
                  onClick={() => setApproveOpen(true)}
                  disabled={!selected || selected.status !== "SUBMITTED"}
                >
                  <Check />
                  Approve Work
                </Button>
              </div>
            </div>
          ) : null}
          {workflow.review.error ? (
            <p className="text-sm text-destructive">
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
            disabled={!selected || workflow.review.isPending}
            onClick={() => {
              if (!selected) return;
              workflow.review.mutate(
                { status: "APPROVED", submissionId: selected.id },
                { onSuccess: () => setApproveOpen(false) },
              );
            }}
          >
            {workflow.review.isPending ? "Approving…" : "Approve Work"}
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
            <p className="text-sm text-destructive">
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
              disabled={!returnNote.trim() || workflow.review.isPending}
            >
              Return Submission
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

  const roots = (comments.data ?? []).filter((item) => !item.parentId);
  const repliesOf = (id: string) =>
    (comments.data ?? []).filter((item) => item.parentId === id);

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
    setBody("");
    setReplyId(null);
    setPendingFiles([]);
  }

  return (
    <Card className={workspaceCard}>
      <CardHeader>
        <CardTitle className="text-[18px]">Comments</CardTitle>
        <CardDescription>
          Mentions, replies, reactions, and files stay on the task.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(comments.data ?? []).length ? (
          <ul className="space-y-3">
            {roots.map((item) => (
              <li key={item.id} className="rounded-xl border border-border px-4 py-3">
                <CommentBody
                  item={item}
                  canWrite={canWrite}
                  onReply={() => setReplyId(item.id)}
                  onReact={(emoji) =>
                    void react.mutateAsync({ commentId: item.id, emoji })
                  }
                />
                {repliesOf(item.id).map((reply) => (
                  <div
                    key={reply.id}
                    className="mt-3 ml-4 rounded-lg border border-border bg-muted px-3 py-2"
                  >
                    <CommentBody
                      item={reply}
                      canWrite={canWrite}
                      onReply={() => setReplyId(reply.id)}
                      onReact={(emoji) =>
                        void react.mutateAsync({ commentId: reply.id, emoji })
                      }
                    />
                  </div>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">No comments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a note for the assignee or reviewer.
            </p>
          </div>
        )}
        {canWrite ? (
          <form className="space-y-2" onSubmit={(event) => void submit(event)}>
            {replyId ? (
              <p className="text-xs text-muted-foreground">
                Replying{" "}
                <button type="button" onClick={() => setReplyId(null)}>
                  · cancel
                </button>
              </p>
            ) : null}
            <textarea
              className={nativeTextareaClass}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a comment. Use @name to mention."
            />
            <input
              type="file"
              multiple
              onChange={(event) =>
                setPendingFiles(Array.from(event.target.files ?? []))
              }
            />
            {addComment.error ? (
              <p className="text-sm text-destructive">
                {addComment.error.message}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={!body.trim() || addComment.isPending}
            >
              {addComment.isPending ? "Posting…" : "Post comment"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CommentBody({
  item,
  canWrite,
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
  onReply: () => void;
  onReact: (emoji: string) => void;
}) {
  const parts = item.body.split(/(@[\w.\-]+)/g);
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
          {initials(item.author.name)}
        </span>
        <p className="text-sm font-medium text-foreground">{item.author.name}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-foreground">
        {parts.map((part, index) =>
          part.startsWith("@") ? (
            <span key={`${part}-${index}`} className="font-medium text-primary">
              {part}
            </span>
          ) : (
            <span key={`${part}-${index}`}>{part}</span>
          ),
        )}
      </p>
      {(item.files ?? []).length ? (
        <div className="mt-2 space-y-1">
          {(item.files ?? []).map((file) => (
            <button
              key={file.id}
              type="button"
              className="block text-xs text-primary"
              onClick={() => void downloadFile(file.id, file.originalName)}
            >
              {file.originalName}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(item.reactions ?? []).map((reaction) => (
          <button
            key={reaction.emoji}
            type="button"
            className="rounded-full bg-muted px-2 py-0.5 text-xs"
            onClick={() => onReact(reaction.emoji)}
          >
            {reaction.emoji} {reaction.count}
          </button>
        ))}
        {canWrite ? (
          <>
            {["👍", "🎉", "✅"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="text-xs text-subtle-foreground"
                onClick={() => onReact(emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={onReply}
            >
              Reply
            </button>
          </>
        ) : null}
        <p className="ml-auto text-xs text-muted-foreground">
          {formatDateTime(item.createdAt)}
        </p>
      </div>
    </>
  );
}

export function TaskWorkflowPanel(props: {
  task: Task;
  userId?: string;
  canWrite: boolean;
  isAdmin: boolean;
}) {
  return (
    <>
      <TaskReviewPanel {...props} />
      <TaskWorkPanel {...props} />
    </>
  );
}
