"use client";

import { Check, LogOut, Monitor, Moon, Plus, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLogout } from "@/features/auth/hooks";
import { useWorkspaces } from "@/features/workspaces/hooks";
import { WorkspaceMark } from "@/features/workspaces/workspace-switcher";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import {
  CREATE_ITEMS,
  SETTINGS_ITEM,
  type NavGroup,
} from "@/components/layout/nav-config";
import { useThemeStore } from "@/lib/theme";
import { useUiStore, type CreateDialogType } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export function CommandPalette({
  groups,
  onCreate,
}: {
  groups: NavGroup[];
  onCreate: (type: CreateDialogType) => void;
}) {
  const router = useRouter();
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const [query, setQuery] = useState("");
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const setCurrentWorkspaceId = useWorkspaceStore((state) => state.setCurrentWorkspaceId);
  const setPreference = useThemeStore((state) => state.setPreference);
  const logout = useLogout();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  function run(action: () => void) {
    setOpen(false);
    setQuery("");
    action();
  }

  const trimmed = query.trim();

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search pages, actions, workspaces…"
      />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {trimmed ? (
          <CommandGroup heading="Search">
            <CommandItem
              value={`search tasks ${trimmed}`}
              onSelect={() =>
                run(() => router.push(`/app/tasks?q=${encodeURIComponent(trimmed)}`))
              }
            >
              <Search />
              Search tasks for “{trimmed}”
            </CommandItem>
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Create">
          {CREATE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.type}
                value={`create ${item.label}`}
                onSelect={() => run(() => onCreate(item.type))}
              >
                <Icon />
                {item.label}
              </CommandItem>
            );
          })}
          <CommandItem value="create new workspace" onSelect={() => run(() => onCreate("workspace"))}>
            <Plus />
            New workspace
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        {groups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`go ${group.label} ${item.label}`}
                  onSelect={() => run(() => router.push(item.href))}
                >
                  <Icon />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandGroup heading="Account">
          <CommandItem value="go settings" onSelect={() => run(() => router.push(SETTINGS_ITEM.href))}>
            <SETTINGS_ITEM.icon />
            Settings
          </CommandItem>
          <CommandItem value="theme light" onSelect={() => run(() => setPreference("light"))}>
            <Sun />
            Switch to light theme
          </CommandItem>
          <CommandItem value="theme dark" onSelect={() => run(() => setPreference("dark"))}>
            <Moon />
            Switch to dark theme
          </CommandItem>
          <CommandItem value="theme system" onSelect={() => run(() => setPreference("system"))}>
            <Monitor />
            Use system theme
          </CommandItem>
          <CommandItem value="log out sign out" onSelect={() => run(() => logout.mutate())}>
            <LogOut />
            Log out
          </CommandItem>
        </CommandGroup>
        {(workspaces.data ?? []).length > 1 ? (
          <CommandGroup heading="Switch workspace">
            {(workspaces.data ?? []).map((workspace) => (
              <CommandItem
                key={workspace.id}
                value={`workspace ${workspace.name}`}
                onSelect={() => run(() => setCurrentWorkspaceId(workspace.id))}
              >
                <WorkspaceMark name={workspace.name} logo={workspace.logo} />
                {workspace.name}
                {workspace.id === currentWorkspaceId ? (
                  <Check className="ml-auto !text-primary" />
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
      <div className="flex items-center gap-4 border-t border-border bg-muted/50 px-4 py-2 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Enter</Kbd> select
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Esc</Kbd> close
        </span>
      </div>
    </CommandDialog>
  );
}
