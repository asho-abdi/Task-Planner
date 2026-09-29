"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, Menu, Plus, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNotifications } from "@/features/collaboration/hooks";
import { useWorkspaces } from "@/features/workspaces/hooks";
import type { PublicUser } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { CommandPalette } from "@/components/layout/command-palette";
import {
  CREATE_ITEMS,
  matchNav,
  navGroupsFor,
} from "@/components/layout/nav-config";
import { NotificationsPopover } from "@/components/layout/notifications-popover";
import { PendingInvitesBanner } from "@/components/layout/pending-invites-banner";
import { SidebarContent } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useUiStore, type CreateDialogType } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

type AppShellProps = {
  user: PublicUser;
  children: ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const hydrateSidebar = useUiStore((state) => state.hydrateSidebar);
  const mobileOpen = useUiStore((state) => state.mobileNavOpen);
  const setMobileOpen = useUiStore((state) => state.setMobileNavOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const [search, setSearch] = useState("");
  const notifications = useNotifications(currentWorkspaceId);
  const unreadCount = notifications.data?.unreadCount ?? 0;
  const isSystemAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  const navGroups = navGroupsFor(isSystemAdmin);
  const currentWorkspace = (workspaces.data ?? []).find(
    (workspace) => workspace.id === currentWorkspaceId,
  );
  const section = matchNav(pathname, navGroups);
  const isDetail = Boolean(section && pathname.length > section.href.length + 1);

  useEffect(() => {
    hydrateSidebar();
  }, [hydrateSidebar]);

  // The shell owns scrolling: the page itself never scrolls, only <main>.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      html.style.height = previous.htmlHeight;
      body.style.height = previous.bodyHeight;
    };
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  function openCreate(type: CreateDialogType) {
    // Defer so the menu/palette finishes closing before the dialog takes focus.
    window.setTimeout(() => {
      if (type === "task") {
        openTaskCreate();
        return;
      }
      setOpenCreateDialog(type);
    }, 0);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = search.trim();
    router.push(q ? `/app/tasks?q=${encodeURIComponent(q)}` : "/app/tasks");
  }

  const crumbs = [
    ...(currentWorkspace ? [{ label: currentWorkspace.name, href: "/app" }] : []),
    ...(section
      ? [{ label: section.label, href: isDetail ? section.href : undefined }]
      : [{ label: "Workspace" }]),
    ...(isDetail ? [{ label: "Details" }] : []),
  ];

  return (
    <div className="bg-background">
      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-drawer hidden h-svh flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[64px]" : "w-[252px]",
        )}
      >
        <SidebarContent user={user} collapsed={collapsed} unreadCount={unreadCount} />
      </aside>

      {/* Mobile drawer */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-drawer bg-overlay data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-drawer flex w-[min(86vw,300px)] flex-col border-r border-sidebar-border bg-sidebar shadow-lg data-[state=open]:animate-slide-in-left focus:outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className="absolute -right-11 top-3 inline-flex size-8 items-center justify-center rounded-md bg-card text-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
            <SidebarContent
              user={user}
              collapsed={false}
              unreadCount={unreadCount}
              showCollapseToggle={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div
        className={cn(
          "flex h-svh min-w-0 flex-col overflow-hidden transition-[margin] duration-200 ease-out",
          collapsed ? "lg:ml-[64px]" : "lg:ml-[252px]",
        )}
      >
        <header className="z-header flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu />
          </Button>

          <Breadcrumbs items={crumbs} className="hidden min-w-0 md:block" />
          <p className="min-w-0 truncate text-base font-semibold md:hidden">
            {section?.label ?? "Workspace"}
          </p>

          <div className="ml-auto flex items-center gap-1.5">
            <form
              role="search"
              onSubmit={submitSearch}
              className="relative hidden w-[clamp(180px,24vw,300px)] sm:block"
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks"
                className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-16 text-base shadow-xs transition-[border-color,box-shadow] placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Open command palette"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Kbd>Ctrl K</Kbd>
              </button>
            </form>
            <Button
              variant="ghost"
              size="icon-sm"
              className="sm:hidden"
              aria-label="Search"
              onClick={() => setCommandOpen(true)}
            >
              <Search />
            </Button>

            <ThemeToggle />
            <NotificationsPopover workspaceId={currentWorkspaceId} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="ml-1 gap-1 pr-2">
                  <Plus />
                  <span className="hidden sm:inline">Create</span>
                  <ChevronDown className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Create new</DropdownMenuLabel>
                {CREATE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.type} onSelect={() => openCreate(item.type)}>
                      <Icon />
                      {item.label.replace("New ", "")}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openCreate("workspace")}>
                  <Plus />
                  Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          id="main-content"
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-6 sm:px-6 lg:px-8"
        >
          <PendingInvitesBanner />
          {children}
        </main>
      </div>

      <CommandPalette groups={navGroups} onCreate={openCreate} />
    </div>
  );
}
