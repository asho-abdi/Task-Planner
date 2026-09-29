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
  Gauge,
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
  Zap,
  type LucideIcon,
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
      { href: "/app/workload", label: "Workload", icon: Gauge },
      { href: "/app/reports", label: "Reports", icon: BarChart3 },
      { href: "/app/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/app/pages", label: "Pages", icon: FileText },
      { href: "/app/todos", label: "Todos", icon: ListTodo },
      { href: "/app/automations", label: "Automations", icon: Zap },
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

function pageTitle(
  pathname: string,
  groups: Array<{
    items: Array<{ href: string; label: string; exact?: boolean }>;
  }>,
) {
  if (pathname.startsWith("/app/settings")) return "Settings";
  if (pathname.startsWith("/app/users")) return "Users";
  const items = groups.flatMap((group) => group.items);
  const match = items
    .filter((item) => isActive(pathname, item.href, item.exact))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Workspace";
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={label}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[15px] font-bold leading-[1.3] text-white transition-colors",
        collapsed && "justify-center px-0",
        active ? "font-extrabold" : "hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {!collapsed ? <span className="min-w-0 truncate">{label}</span> : null}
      {badge && badge > 0 ? (
        collapsed ? (
          <span className="absolute ml-4 mt-[-10px] h-1.5 w-1.5 rounded-full bg-primary" />
        ) : (
          <span className="ml-auto rounded-md bg-card/10 px-1.5 py-px text-[10px] font-semibold tabular-nums text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )
      ) : null}
    </Link>
  );
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const workspaces = useWorkspaces();
  const currentWorkspaceId = useWorkspaceStore(
    (state) => state.currentWorkspaceId,
  );
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

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const unreadCount = notifications.data?.unreadCount ?? 0;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = search.trim();
    router.push(q ? `/app/tasks?q=${encodeURIComponent(q)}` : "/app/tasks");
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-14 items-center gap-2.5 border-b border-white/[0.06] px-3",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold tracking-wide text-white">
          TPT
        </div>
        {!collapsed ? (
          <p
            className="min-w-0 truncate text-[17px] font-extrabold leading-[1.2] tracking-[-0.02em] text-white"
            title="Task Planner and Tracker"
          >
            Task Planner
          </p>
        ) : null}
      </div>

      <WorkspaceSwitcher collapsed={collapsed} />

      <nav className="mt-2 flex-1 space-y-5 overflow-y-auto px-2 pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {navGroups.map((group, index) => (
          <div key={group.label} className="space-y-0.5">
            {collapsed ? (
              index > 0 ? (
                <div className="mx-auto my-2 h-px w-5 bg-card/10" />
              ) : null
            ) : (
              <p className="px-2 pb-1.5 pt-1 text-[11px] font-extrabold uppercase leading-[1.2] tracking-[0.10em] text-muted-foreground">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <SidebarNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(pathname, item.href, item.exact)}
                collapsed={collapsed}
                onNavigate={() => setMobileOpen(false)}
                badge={
                  item.href === "/app/notifications" ? unreadCount : undefined
                }
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-1.5 py-1.5",
            collapsed && "justify-center px-0",
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-white">
            {initials}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold leading-[1.3] text-white">
                {user.name}
              </p>
              <p className="truncate text-[12px] font-medium leading-[1.4] text-muted-foreground">
                {user.email}
              </p>
            </div>
          ) : null}
        </div>
        <SidebarNavLink
          href="/app/settings"
          label="Settings"
          icon={Settings}
          active={pathname.startsWith("/app/settings")}
          collapsed={collapsed}
          onNavigate={() => setMobileOpen(false)}
        />
        <button
          type="button"
          title="Logout"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-[15px] font-bold leading-[1.3] text-white transition-colors",
            collapsed && "justify-center px-0",
          )}
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!collapsed
            ? logout.isPending
              ? "Signing out…"
              : "Log out"
            : null}
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
          "fixed inset-y-0 left-0 z-50 flex h-svh w-[240px] flex-col overflow-hidden bg-sidebar transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed && "lg:w-[72px]",
        )}
      >
        {sidebar}
      </aside>

      <div
        className={cn(
          "flex h-svh min-w-0 flex-col overflow-hidden",
          collapsed ? "lg:ml-[72px]" : "lg:ml-[240px]",
        )}
      >
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
          >
            <PanelLeft />
          </Button>
          <h1 className="hidden min-w-0 shrink-0 text-[18px] font-bold leading-[1.2] tracking-[-0.02em] text-foreground md:block lg:text-[19px]">
            {pageTitle(pathname, navGroups)}
          </h1>
          <form
            className="relative min-w-0 flex-1"
            onSubmit={submitSearch}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks"
              className="h-8 max-w-lg rounded-md border-border bg-muted pl-9 pr-16 text-[14px] font-medium shadow-none placeholder:font-normal placeholder:text-subtle-foreground"
              aria-label="Search tasks"
            />
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center rounded border border-border bg-card px-1.5 py-0.5 text-[12px] font-semibold leading-none text-subtle-foreground sm:inline-flex"
            >
              Ctrl K
            </button>
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative" ref={notifyMenuRef}>
              <button
                type="button"
                aria-label="Notifications"
                onClick={(event) => {
                  event.stopPropagation();
                  setHeaderMenu((current) =>
                    current === "notify" ? null : "notify",
                  );
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Bell className="h-4 w-4" strokeWidth={1.75} />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                ) : null}
              </button>
              {headerMenu === "notify" ? (
                <div
                  className="absolute right-0 top-10 z-40 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-[0_12px_32px_rgba(15,23,42,0.1)]"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <p className="text-[14px] font-bold text-foreground">
                      Notifications
                    </p>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        className="text-[13px] font-medium text-primary"
                        onClick={() => void markAllRead.mutate()}
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {(notifications.data?.items ?? []).length === 0 ? (
                      <p className="px-3 py-6 text-[14px] font-medium text-muted-foreground">
                        You&apos;re all caught up.
                      </p>
                    ) : (
                      (notifications.data?.items ?? []).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            "relative block w-full border-b border-muted px-3 py-2.5 text-left last:border-0 hover:bg-muted",
                            !item.isRead && "bg-muted",
                          )}
                          onClick={() => {
                            setHeaderMenu(null);
                            if (!item.isRead) void markRead.mutate(item.id);
                            router.push(notificationHref(item));
                          }}
                        >
                          {!item.isRead ? (
                            <span className="absolute left-0 top-3 bottom-3 w-[2px] bg-primary" />
                          ) : null}
                          <p className="text-[14px] font-semibold text-foreground">
                            {item.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[12px] font-medium text-muted-foreground">
                            {item.message}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <Link
                    href="/app/notifications"
                    className="block border-t border-border px-3 py-2 text-center text-[13px] font-semibold text-primary"
                    onClick={() => setHeaderMenu(null)}
                  >
                    View all
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="relative" ref={createMenuRef}>
              <Button
                size="sm"
                className="h-8"
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
                  className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[0_12px_32px_rgba(15,23,42,0.1)]"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {CREATE_ITEMS.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      className="flex w-full px-3 py-1.5 text-left text-[14px] font-medium text-foreground hover:bg-muted"
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
            <Link
              href="/app/settings"
              title={user.name}
              className="ml-1 hidden h-8 items-center gap-2 rounded-md pl-1 pr-2 hover:bg-muted sm:flex"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                {initials}
              </span>
              <span className="max-w-[120px] truncate text-[14px] font-bold text-foreground">
                {user.name.split(" ")[0]}
              </span>
            </Link>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-6">
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
