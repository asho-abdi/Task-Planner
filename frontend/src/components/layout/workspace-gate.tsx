"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useWorkspaces } from "@/features/workspaces/hooks";

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const workspaces = useWorkspaces();

  useEffect(() => {
    if (workspaces.isLoading) {
      return;
    }
    if (!workspaces.data?.length && pathname !== "/workspace/create") {
      router.replace("/workspace/create");
    }
  }, [pathname, router, workspaces.data, workspaces.isLoading]);

  if (workspaces.isLoading || !workspaces.data?.length) {
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
