"use client";

import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicUser } from "@/features/auth/types";
import { WorkspaceSwitcher } from "@/features/workspaces/workspace-switcher";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { UserMenu } from "@/components/layout/user-menu";
import {
  isActive,
  navGroupsFor,
  type NavItem,
} from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

function SidebarLink({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md text-base font-medium outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "mx-auto w-10 justify-center" : "px-2",
        active
          ? "bg-sidebar-active text-foreground shadow-xs ring-1 ring-sidebar-border"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-sidebar-muted group-hover:text-foreground",
        )}
        strokeWidth={active ? 2.25 : 1.9}
      />
      {collapsed ? null : <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {badge && badge > 0 ? (
        collapsed ? (
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
        ) : (
          <span className="rounded-full bg-primary px-1.5 text-2xs font-semibold leading-4 text-primary-foreground tabular">
            {badge > 99 ? "99+" : badge}
          </span>
        )
      ) : null}
    </Link>
  );

  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function SidebarContent({
  user,
  collapsed,
  unreadCount,
  onNavigate,
  showCollapseToggle = true,
}: {
  user: PublicUser;
  collapsed: boolean;
  unreadCount: number;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}) {
  const pathname = usePathname();
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const isSystemAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  const groups = navGroupsFor(isSystemAdmin);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-1 p-2", collapsed && "flex-col")}>
        <div className={cn("min-w-0", collapsed ? "w-full" : "flex-1")}>
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
        {showCollapseToggle ? (
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </Tooltip>
        ) : null}
      </div>

      <div className="px-2 pb-2">
        {collapsed ? (
          <Tooltip content="Search (Ctrl K)" side="right">
            <button
              type="button"
              aria-label="Search and commands"
              onClick={() => setCommandOpen(true)}
              className="mx-auto flex size-10 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              setCommandOpen(true);
            }}
            className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-card px-2 text-base text-subtle-foreground shadow-xs transition-colors hover:border-border-strong hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
        )}
      </div>

      <nav
        aria-label="Main"
        className="scrollbar-none flex-1 space-y-4 overflow-y-auto px-2 pb-4 pt-1"
      >
        {groups.map((group, index) => (
          <div key={group.label} className="space-y-px">
            {collapsed ? (
              index > 0 ? <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" /> : null
            ) : (
              <p className="px-2 pb-1 text-2xs font-medium uppercase tracking-[0.08em] text-sidebar-muted">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href, item.exact)}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badge={item.href === "/app/notifications" ? unreadCount : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <UserMenu user={user} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
