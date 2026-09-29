"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useWorkspaces } from "@/features/workspaces/hooks";
import { useWorkspaceStore } from "@/store/workspace-store";

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore(
    (state) => state.currentWorkspaceId,
  );
  const setCurrentWorkspaceId = useWorkspaceStore(
    (state) => state.setCurrentWorkspaceId,
  );
  const hydrate = useWorkspaceStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (workspaces.isLoading) {
      return;
    }
    if (!workspaces.data?.length && pathname !== "/workspace/create") {
      router.replace("/workspace/create");
      return;
    }
    if (!workspaces.data?.length) {
      return;
    }
    const exists = workspaces.data.some(
      (workspace) => workspace.id === currentWorkspaceId,
    );
    if (!currentWorkspaceId || !exists) {
      setCurrentWorkspaceId(workspaces.data[0].id);
    }
  }, [
    currentWorkspaceId,
    pathname,
    router,
    setCurrentWorkspaceId,
    workspaces.data,
    workspaces.isLoading,
  ]);

  const list = workspaces.data ?? [];
  const ready = list.some((workspace) => workspace.id === currentWorkspaceId);

  if (workspaces.isLoading || !ready) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-sidebar" />
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return children;
}
