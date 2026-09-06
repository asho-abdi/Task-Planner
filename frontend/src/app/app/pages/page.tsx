"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreatePage, usePages } from "@/features/collaboration/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function PagesIndex() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const pages = usePages(workspaceId);
  const createPage = useCreatePage();
  const router = useRouter();
  const canWrite = workspace && workspace.role !== "VIEWER";
  const [title, setTitle] = useState("");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      const page = await createPage.mutateAsync({ title: title.trim() });
      setTitle("");
      router.push(`/app/pages/${page.id}`);
    } catch {
      // Error is shown from the mutation.
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Pages"
        description="Workspace notes. Create immediately, then fill in the body."
      />
      {canWrite ? (
        <div className="space-y-2">
          <form className="flex gap-2" onSubmit={onCreate}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Page title"
              required
            />
            <Button type="submit" disabled={createPage.isPending || !title.trim()}>
              New page
            </Button>
          </form>
          {createPage.error ? (
            <p className="text-sm text-destructive">{createPage.error.message}</p>
          ) : null}
        </div>
      ) : null}
      {pages.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : pages.isError ? (
        <p className="text-sm text-destructive">{pages.error.message}</p>
      ) : !pages.data?.length ? (
        <EmptyState title="No pages yet" />
      ) : (
        <div className="space-y-3">
          {pages.data.map((page) => (
            <Link key={page.id} href={`/app/pages/${page.id}`}>
              <Surface>
                <p className="font-medium">{page.title}</p>
                <p className="text-sm text-muted-foreground">
                  {page.author.name} · {new Date(page.updatedAt).toLocaleString()}
                </p>
              </Surface>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
