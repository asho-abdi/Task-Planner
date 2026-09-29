"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, FileQuestion, Save, Trash2 } from "lucide-react";
import { EmptyState, PageShell } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { usePage, useUpdatePage, useDeletePage } from "@/features/collaboration/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { WorkspacePage } from "@/features/collaboration/types";

export default function PageDetail() {
  const params = useParams<{ pageId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const page = usePage(workspaceId, params.pageId);
  const workspace = useCurrentWorkspace();
  const canWrite = Boolean(workspace && workspace.role !== "VIEWER");

  if (page.isLoading) {
    return (
      <PageShell width="narrow">
        <Skeleton className="h-3.5 w-40" />
        <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-xs sm:p-10">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!page.data) {
    return (
      <PageShell width="narrow">
        <Breadcrumbs items={[{ label: "Pages", href: "/app/pages" }, { label: "Not found" }]} />
        {page.isError ? (
          <ErrorState
            title="Couldn't load this page"
            description={page.error.message}
            action={
              <Button size="sm" variant="outline" onClick={() => void page.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <EmptyState
            icon={FileQuestion}
            title="Page not found."
            description="It may have been deleted or you may not have access."
            action={
              <Button asChild variant="outline">
                <Link href="/app/pages">Back to pages</Link>
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageEditor
      key={page.data.updatedAt}
      page={page.data}
      canWrite={canWrite}
    />
  );
}

function PageEditor({
  page,
  canWrite,
}: {
  page: WorkspacePage;
  canWrite: boolean;
}) {
  const updatePage = useUpdatePage(page.id);
  const removePage = useDeletePage(page.id);
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = title !== page.title || body !== page.body;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  async function save(event: FormEvent) {
    event.preventDefault();
    await updatePage.mutateAsync({ title, body });
    toast.success("Page saved");
  }

  return (
    <PageShell width="narrow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs
          items={[{ label: "Pages", href: "/app/pages" }, { label: page.title || "Untitled" }]}
        />
        {canWrite ? (
          <div className="flex items-center gap-2">
            <span
              className="hidden text-xs text-subtle-foreground sm:inline"
              aria-live="polite"
            >
              {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-danger-soft-foreground hover:bg-danger-soft hover:text-danger-soft-foreground"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              Delete
            </Button>
            <Button
              type="submit"
              form="page-editor"
              size="sm"
              loading={updatePage.isPending}
            >
              {updatePage.isPending ? null : <Save />}
              Save
            </Button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="size-3.5" />
            Read only
          </span>
        )}
      </div>

      <form
        id="page-editor"
        onSubmit={save}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && canWrite) {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
        className="rounded-xl border border-border bg-card shadow-xs"
      >
        <div className="space-y-4 px-5 pb-4 pt-6 sm:px-10 sm:pt-10">
          <label htmlFor="title" className="sr-only">
            Title
          </label>
          <input
            id="title"
            value={title}
            disabled={!canWrite}
            placeholder="Untitled"
            onChange={(event) => setTitle(event.target.value)}
            className="w-full bg-transparent font-heading text-2xl font-semibold tracking-[-0.02em] text-foreground placeholder:text-subtle-foreground focus:outline-none disabled:cursor-default sm:text-3xl"
          />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Avatar name={page.author.name} size="xs" />
            <span>{page.author.name}</span>
            <span aria-hidden className="text-subtle-foreground">·</span>
            <time dateTime={page.updatedAt} title={formatDateTime(page.updatedAt)}>
              Updated {formatRelativeTime(page.updatedAt)}
            </time>
            <span aria-hidden className="text-subtle-foreground">·</span>
            <span className="tabular">
              {words} {words === 1 ? "word" : "words"}
            </span>
          </div>
        </div>
        <div className="border-t border-border px-5 py-5 sm:px-10 sm:py-8">
          <label htmlFor="body" className="sr-only">
            Body
          </label>
          <textarea
            id="body"
            rows={16}
            value={body}
            disabled={!canWrite}
            placeholder={canWrite ? "Start writing…" : "This page is empty."}
            onChange={(event) => setBody(event.target.value)}
            className="block min-h-[50vh] w-full resize-none bg-transparent text-md leading-7 text-foreground field-sizing-content placeholder:text-subtle-foreground focus:outline-none disabled:cursor-default"
          />
        </div>
        {canWrite ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-subtle-foreground sm:px-10">
            <span className="hidden sm:inline">Press Ctrl + S to save</span>
            <span className="sm:hidden" aria-live="polite">
              {dirty ? "Unsaved changes" : "Saved"}
            </span>
          </div>
        ) : null}
      </form>

      <Dialog open={confirmDelete} onOpenChange={(open) => !removePage.isPending && setConfirmDelete(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this page?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{page.title || "Untitled"}</span> will be
              permanently deleted for everyone in the workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={removePage.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={removePage.isPending}
              onClick={async () => {
                await removePage.mutateAsync();
                toast.success("Page deleted");
                router.push("/app/pages");
              }}
            >
              Delete page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
