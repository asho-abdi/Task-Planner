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
        "absolute z-30 overflow-hidden rounded-xl border border-white/10 bg-[#111827] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.35)]",
        collapsed ? "left-full top-0 ml-2 w-56" : "mt-1.5 w-full",
      )}
    >
      {(workspaces.data ?? []).map((workspace) => (
        <button
          key={workspace.id}
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08]",
            workspace.id === currentWorkspaceId && "bg-white/[0.06]",
          )}
          onClick={() => {
            setCurrentWorkspaceId(workspace.id);
            setOpen(false);
          }}
        >
          <WorkspaceMark name={workspace.name} logo={workspace.logo} />
          <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
          {workspace.id === currentWorkspaceId ? (
            <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
          ) : null}
        </button>
      ))}
      <button
        type="button"
        className="flex w-full items-center gap-2.5 border-t border-white/10 px-3 py-2 text-left text-[14px] font-semibold text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-white"
        onClick={() => {
          setOpen(false);
          setOpenCreateDialog("workspace");
        }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
        Create workspace
      </button>
    </div>
  );

  if (collapsed) {
    return (
      <div ref={rootRef} className="relative flex justify-center px-2 py-2">
        <button
          type="button"
          title={current?.name ?? "Workspace"}
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-white/[0.06]"
          onClick={() => setOpen((value) => !value)}
        >
          <WorkspaceMark name={current?.name} logo={current?.logo} />
        </button>
        {open ? menu : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative px-2 py-2">
      <button
        type="button"
        aria-label="Workspace"
        className="flex h-8 w-full items-center justify-between rounded-md px-2 text-left text-[14px] font-bold leading-[1.3] text-white outline-none hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <WorkspaceMark name={current?.name} logo={current?.logo} />
          <span className="truncate font-bold">
            {current?.name ?? "Select workspace"}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
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
        className={cn("h-5 w-5 rounded-md object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[9px] font-semibold text-white",
        className,
      )}
    >
      {(name ?? "W").slice(0, 1).toUpperCase()}
    </span>
  );
}
