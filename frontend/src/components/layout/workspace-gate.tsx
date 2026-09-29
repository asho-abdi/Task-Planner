"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useWorkspaces } from "@/features/workspaces/hooks";
import { useWorkspaceStore } from "@/store/workspace-store";
import { AppLoadingScreen } from "@/components/layout/app-loading";

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
    return <AppLoadingScreen />;
  }

  return children;
}
