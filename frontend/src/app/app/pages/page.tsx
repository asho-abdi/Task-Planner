"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronRight, FilePlus2, FileText, NotebookText, Search } from "lucide-react";
import { EmptyState, ListPanel, PageHeader, PageShell } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useCreatePage, usePages } from "@/features/collaboration/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { useRouter } from "next/navigation";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

function excerpt(body: string) {
  const text = body.replace(/[#>*_`\-]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export default function PagesIndex() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const pages = usePages(workspaceId);
  const createPage = useCreatePage();
  const router = useRouter();
  const canWrite = workspace && workspace.role !== "VIEWER";
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...(pages.data ?? [])]
      .filter(
        (page) =>
          !needle ||
          page.title.toLowerCase().includes(needle) ||
          page.body.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pages.data, query]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      const page = await createPage.mutateAsync({ title: title.trim() });
      setTitle("");
      toast.success("Page created");
      router.push(`/app/pages/${page.id}`);
    } catch {
      // Error is shown from the mutation.
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Pages"
        icon={NotebookText}
        description="Workspace notes. Create immediately, then fill in the body."
        meta={
          pages.data?.length ? (
            <span className="tabular">
              {pages.data.length} {pages.data.length === 1 ? "page" : "pages"}
            </span>
          ) : null
        }
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {canWrite ? (
          <div className="w-full space-y-2 md:max-w-lg">
            <form className="flex gap-2" onSubmit={onCreate}>
              <div className="relative flex-1">
                <FilePlus2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="New page title"
                  aria-label="New page title"
                  className="pl-8"
                  required
                />
              </div>
              <Button type="submit" disabled={!title.trim()} loading={createPage.isPending}>
                New page
              </Button>
            </form>
            {createPage.error ? (
              <p className="text-sm text-danger-soft-foreground">{createPage.error.message}</p>
            ) : null}
          </div>
        ) : null}
        {pages.data?.length ? (
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages"
              aria-label="Search pages"
              className="pl-8"
            />
          </div>
        ) : null}
      </div>
      {pages.isLoading ? (
        <ListPanel>
          <SkeletonList rows={5} />
        </ListPanel>
      ) : pages.isError ? (
        <ErrorState
          title="Couldn't load pages"
          description={pages.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void pages.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !pages.data?.length ? (
        <ListPanel>
          <EmptyState
            icon={NotebookText}
            title="No pages yet"
            description={
              canWrite
                ? "Type a title above to create your first page."
                : "Pages written by your team will show up here."
            }
          />
        </ListPanel>
      ) : !sorted.length ? (
        <ListPanel>
          <EmptyState
            compact
            icon={Search}
            title="No matching pages"
            description={`Nothing matches “${query.trim()}”.`}
            action={
              <Button size="sm" variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        </ListPanel>
      ) : (
        <ListPanel>
          <ul className="divide-y divide-border">
            {sorted.map((page) => {
              const preview = excerpt(page.body);
              return (
                <li key={page.id}>
                  <Link
                    href={`/app/pages/${page.id}`}
                    className="group flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none sm:gap-4 sm:px-5"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-primary-soft text-primary-soft-foreground">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-md font-medium text-foreground group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">
                        {page.title || "Untitled"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {preview || <span className="italic text-subtle-foreground">Empty page</span>}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-subtle-foreground">
                        <Avatar name={page.author.name} size="xs" />
                        <span className="truncate text-muted-foreground">{page.author.name}</span>
                        <span aria-hidden>·</span>
                        <time dateTime={page.updatedAt} title={formatDateTime(page.updatedAt)}>
                          Updated {formatRelativeTime(page.updatedAt)}
                        </time>
                      </div>
                    </div>
                    <ChevronRight className="mt-2.5 size-4 shrink-0 text-subtle-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </ListPanel>
      )}
    </PageShell>
  );
}
