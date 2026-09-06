"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  CheckSquare,
  Files,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  Target,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { WorkspaceSwitcher } from "@/features/workspaces/workspace-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLogout } from "@/features/auth/hooks";
import { useWorkspaces } from "@/features/workspaces/hooks";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/collaboration/hooks";
import { notificationHref } from "@/features/collaboration/api";
import type { PublicUser } from "@/features/auth/types";
import { cn } from "@/lib/utils";
import { useUiStore, type CreateDialogType } from "@/store/ui-store";
import { PendingInvitesBanner } from "@/components/layout/pending-invites-banner";
import { useWorkspaceStore } from "@/store/workspace-store";

type AppShellProps = {
  user: PublicUser;
  children: ReactNode;
};

const NAV = [
  {
    label: "Workspace",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/app/my-day", label: "My Day", icon: Sun },
      { href: "/app/projects", label: "Projects", icon: FolderKanban },
      { href: "/app/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/app/teams", label: "Teams", icon: Users },
      { href: "/app/meetings", label: "Meetings", icon: CalendarDays },
      { href: "/app/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Collaborate",
    items: [
      { href: "/app/chat", label: "Chat", icon: MessageSquare },
      { href: "/app/files", label: "Files", icon: Files },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/app/goals", label: "Goals", icon: Target },
      { href: "/app/workload", label: "Workload", icon: Users },
      { href: "/app/reports", label: "Reports", icon: BarChart3 },
      { href: "/app/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/app/pages", label: "Pages", icon: FileText },
      { href: "/app/todos", label: "Todos", icon: ListTodo },
      { href: "/app/risk", label: "Risk", icon: TriangleAlert },
    ],
  },
];

const CREATE_ITEMS: Array<{ type: CreateDialogType; label: string }> = [
  { type: "task", label: "New task" },
  { type: "project", label: "New project" },
  { type: "meeting", label: "New meeting" },
  { type: "todo", label: "New todo" },
  { type: "goal", label: "New goal" },
  { type: "workspace", label: "New workspace" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore(
    (state) => state.currentWorkspaceId,
  );
  const setCurrentWorkspaceId = useWorkspaceStore(
    (state) => state.setCurrentWorkspaceId,
  );
  const hydrate = useWorkspaceStore((state) => state.hydrate);
  const setOpenCreateDialog = useUiStore((state) => state.setOpenCreateDialog);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const mobileOpen = useUiStore((state) => state.mobileNavOpen);
  const setMobileOpen = useUiStore((state) => state.setMobileNavOpen);
  const [headerMenu, setHeaderMenu] = useState<"create" | "notify" | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const notifications = useNotifications(currentWorkspaceId);
  const markAllRead = useMarkAllRead();
  const markRead = useMarkNotificationRead();
  const isSystemAdmin =
    user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navGroups = isSystemAdmin
    ? [
        ...NAV,
        {
          label: "Admin",
          items: [{ href: "/app/users", label: "Users", icon: Users }],
        },
      ]
    : NAV;

  const createMenuRef = useRef<HTMLDivElement>(null);
  const notifyMenuRef = useRef<HTMLDivElement>(null);

  function openCreate(type: CreateDialogType) {
    setHeaderMenu(null);
    window.setTimeout(() => {
      if (type === "task") {
        openTaskCreate();
        return;
      }
      setOpenCreateDialog(type);
    }, 0);
  }

  const commandItems = [
    ...navGroups.flatMap((group) =>
      group.items.map((item) => ({
        id: item.href,
        label: item.label,
        run: () => router.push(item.href),
      })),
    ),
    ...CREATE_ITEMS.map((item) => ({
      id: `create-${item.type}`,
      label: item.label,
      run: () => openCreate(item.type),
    })),
  ].filter((item) =>
    item.label.toLowerCase().includes(commandQuery.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!headerMenu) {
      return;
    }
    function close(event: PointerEvent) {
      const target = event.target as Node | null;
      const root =
        headerMenu === "create" ? createMenuRef.current : notifyMenuRef.current;
      if (target && root?.contains(target)) {
        return;
      }
      setHeaderMenu(null);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [headerMenu]);

  useEffect(() => {
    if (!workspaces.data?.length) {
      return;
    }
    const exists = workspaces.data.some(
      (workspace) => workspace.id === currentWorkspaceId,
    );
    if (!currentWorkspaceId || !exists) {
      setCurrentWorkspaceId(workspaces.data[0].id);
    }
  }, [currentWorkspaceId, workspaces.data, setCurrentWorkspaceId]);

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = search.trim();
    router.push(q ? `/app/tasks?q=${encodeURIComponent(q)}` : "/app/tasks");
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 pt-4",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[10px] font-semibold text-white">
          TPT
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p
              className="truncate text-[13px] font-semibold leading-tight text-white"
              title="Task Planner and Tracker"
            >
              Task Planner and Tracker
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              Workspace
            </p>
          </div>
        ) : null}
      </div>

      <WorkspaceSwitcher collapsed={collapsed} />

      <nav className="mt-4 flex-1 space-y-4 overflow-y-auto px-2.5 pb-3">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-primary text-white"
                      : "text-sidebar-foreground hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 px-2.5 py-3">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2",
            collapsed && "justify-center px-2",
          )}
        >
          <div className="relative shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
              {initials}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-[#16A34A]"
              title="Active"
            />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-white">
                {user.name}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-[#16A34A]">
                Active
              </p>
            </div>
          ) : null}
        </div>
        <Link
          href="/app/settings"
          title="Settings"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
            collapsed && "justify-center px-2",
            pathname.startsWith("/app/settings")
              ? "bg-primary text-white"
              : "text-sidebar-foreground hover:bg-white/10 hover:text-white",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed ? "Settings" : null}
        </Link>
        <button
          type="button"
          title="Logout"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white",
            collapsed && "justify-center px-2",
          )}
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed ? (logout.isPending ? "Signing out…" : "Logout") : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-background">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-svh w-[248px] flex-col overflow-hidden border-r border-white/5 bg-sidebar transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed && "lg:w-[80px]",
        )}
      >
        {sidebar}
      </aside>

      <div
        className={cn(
          "flex h-svh min-w-0 flex-col overflow-hidden",
          collapsed ? "lg:ml-[80px]" : "lg:ml-[248px]",
        )}
      >
        <header className="z-30 flex shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
          >
            <PanelLeft />
          </Button>
          <form className="relative min-w-0 flex-1" onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks or press Ctrl+K"
              className="h-9 max-w-md rounded-full border border-[#E5E7EB] bg-white pl-9 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              aria-label="Search tasks"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative" ref={notifyMenuRef}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                onClick={(event) => {
                  event.stopPropagation();
                  setHeaderMenu((current) =>
                    current === "notify" ? null : "notify",
                  );
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className="relative"
              >
                <Bell />
                {(notifications.data?.unreadCount ?? 0) > 0 ? (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
                ) : null}
              </Button>
              {headerMenu === "notify" ? (
                <div
                  className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-border bg-card p-3 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Notifications</p>
                    {(notifications.data?.unreadCount ?? 0) > 0 ? (
                      <button
                        type="button"
                        className="text-xs text-primary"
                        onClick={() => void markAllRead.mutate()}
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                    {(notifications.data?.items ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        You&apos;re all caught up.
                      </p>
                    ) : (
                      (notifications.data?.items ?? []).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            "block w-full rounded-xl px-2 py-2 text-left hover:bg-secondary",
                            !item.isRead && "bg-indigo-50/70",
                          )}
                          onClick={() => {
                            setHeaderMenu(null);
                            if (!item.isRead) void markRead.mutate(item.id);
                            router.push(notificationHref(item));
                          }}
                        >
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.message}
                          </p>
                        </button>
                      ))
                    )}
                    <Link
                      href="/app/notifications"
                      className="mt-2 block text-center text-xs text-primary"
                      onClick={() => setHeaderMenu(null)}
                    >
                      Open notification center
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative" ref={createMenuRef}>
              <Button
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setHeaderMenu((current) =>
                    current === "create" ? null : "create",
                  );
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Plus />
                New
              </Button>
              {headerMenu === "create" ? (
                <div
                  className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {CREATE_ITEMS.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      className="flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openCreate(item.type);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <PendingInvitesBanner />
          {children}
        </main>
      </div>
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Jump to</DialogTitle>
          </DialogHeader>
          <Input
            value={commandQuery}
            onChange={(event) => setCommandQuery(event.target.value)}
            placeholder="Search pages and actions"
            autoFocus
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {commandItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setCommandOpen(false);
                  setCommandQuery("");
                  item.run();
                }}
              >
                {item.label}
              </button>
            ))}
            {commandItems.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No matching commands.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
