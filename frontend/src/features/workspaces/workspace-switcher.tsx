"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/features/workspaces/hooks";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore(
    (state) => state.currentWorkspaceId,
  );
  const setCurrentWorkspaceId = useWorkspaceStore(
    (state) => state.setCurrentWorkspaceId,
  );
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const list = workspaces.data ?? [];
  const current = list.find((workspace) => workspace.id === currentWorkspaceId);

  if (workspaces.isLoading) {
    return collapsed ? (
      <Skeleton className="mx-auto size-8 rounded-lg" />
    ) : (
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-3 w-28" />
      </div>
    );
  }

  const trigger = (
    <DropdownMenuTrigger
      aria-label={`Workspace: ${current?.name ?? "none"}. Switch workspace`}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg text-left outline-none transition-colors duration-150",
        "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent",
        collapsed ? "size-10 justify-center" : "h-11 px-2",
      )}
    >
      <WorkspaceMark
        name={current?.name}
        logo={current?.logo}
        className="size-7 rounded-lg text-xs"
      />
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-foreground">
              {current?.name ?? "Select workspace"}
            </span>
            {current ? (
              <span className="block truncate text-2xs text-sidebar-muted">
                {ROLE_LABEL[current.role] ?? current.role} · {list.length}{" "}
                {list.length === 1 ? "workspace" : "workspaces"}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted transition-colors group-hover:text-foreground" />
        </>
      )}
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip content={current?.name ?? "Workspace"} side="right">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        align="start"
        side={collapsed ? "right" : "bottom"}
        className="w-64"
      >
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {list.map((workspace) => {
          const active = workspace.id === currentWorkspaceId;
          return (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => setCurrentWorkspaceId(workspace.id)}
              className="h-10"
            >
              <WorkspaceMark
                name={workspace.name}
                logo={workspace.logo}
                className="size-6 rounded-md"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{workspace.name}</span>
                <span className="block text-2xs text-muted-foreground">
                  {ROLE_LABEL[workspace.role] ?? workspace.role}
                </span>
              </span>
              {active ? <Check className="!text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            window.setTimeout(() => setOpenCreateDialog("workspace"), 0);
          }}
        >
          <Plus />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
        className={cn("size-5 shrink-0 rounded-md object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md bg-primary font-heading text-[10px] font-semibold text-primary-foreground",
        className,
      )}
    >
      {(name ?? "W").slice(0, 1).toUpperCase()}
    </span>
  );
}
