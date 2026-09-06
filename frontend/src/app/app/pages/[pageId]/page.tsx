"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PageHeader, PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePage, useUpdatePage } from "@/features/collaboration/hooks";
import { deletePage } from "@/features/collaboration/api";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { nativeTextareaClass } from "@/lib/utils";
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
      <PageShell>
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (!page.data) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Page not found.</p>
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
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);

  async function save(event: FormEvent) {
    event.preventDefault();
    await updatePage.mutateAsync({ title, body });
  }

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title={page.title}
        backHref="/app/pages"
        backLabel="Back to pages"
        description={`Updated ${new Date(page.updatedAt).toLocaleString()}`}
      />
      <form className="space-y-4" onSubmit={save}>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            disabled={!canWrite}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">Body</Label>
          <textarea
            id="body"
            className={nativeTextareaClass}
            rows={16}
            value={body}
            disabled={!canWrite}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={updatePage.isPending}>
              Save
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!window.confirm("Delete this page?")) return;
                await deletePage(page.id);
                router.push("/app/pages");
              }}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </form>
    </PageShell>
  );
}
