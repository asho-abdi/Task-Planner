"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/features/workspaces/hooks";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore(
    (state) => state.currentWorkspaceId,
  );
  const setCurrentWorkspaceId = useWorkspaceStore(
    (state) => state.setCurrentWorkspaceId,
  );
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = (workspaces.data ?? []).find(
    (workspace) => workspace.id === currentWorkspaceId,
  );

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const menu = (
    <div
      className={cn(
        "absolute z-30 overflow-hidden rounded-xl border border-white/10 bg-[#111827] py-1 shadow-xl",
        collapsed ? "left-full top-0 ml-2 w-56" : "mt-2 w-full",
      )}
    >
      {(workspaces.data ?? []).map((workspace) => (
        <button
          key={workspace.id}
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10"
          onClick={() => {
            setCurrentWorkspaceId(workspace.id);
            setOpen(false);
          }}
        >
          <WorkspaceMark name={workspace.name} logo={workspace.logo} />
          <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
          {workspace.id === currentWorkspaceId ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : null}
        </button>
      ))}
      <button
        type="button"
        className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-sm text-white hover:bg-white/10"
        onClick={() => {
          setOpen(false);
          setOpenCreateDialog("workspace");
        }}
      >
        <Plus className="h-3.5 w-3.5" />
            Create Workspace
      </button>
    </div>
  );

  if (collapsed) {
    return (
      <div ref={rootRef} className="relative flex justify-center px-2 pt-5">
        <button
          type="button"
          title={current?.name ?? "Workspace"}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-xs font-semibold text-white"
          onClick={() => setOpen((value) => !value)}
        >
          <WorkspaceMark name={current?.name} logo={current?.logo} />
        </button>
        {open ? menu : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative px-3 pt-5">
      <button
        type="button"
        aria-label="Workspace"
        className="flex h-10 w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 text-left text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <WorkspaceMark name={current?.name} logo={current?.logo} />
          <span className="truncate">{current?.name ?? "Select workspace"}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
      {open ? menu : null}
    </div>
  );
}

export function WorkspaceMark({
  name,
  logo,
  className,
}: {
  name?: string;
  logo?: string | null;
  className?: string;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        className={cn("h-6 w-6 rounded-md object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-white",
        className,
      )}
    >
      {(name ?? "W").slice(0, 1).toUpperCase()}
    </span>
  );
}
