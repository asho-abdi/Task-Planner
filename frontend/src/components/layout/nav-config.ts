import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  CheckSquare,
  FileText,
  Files,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Settings,
  ShieldUser,
  Sun,
  Target,
  TriangleAlert,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CreateDialogType } from "@/store/ui-store";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Home",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/app/my-day", label: "My Day", icon: Sun },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/app/projects", label: "Projects", icon: FolderKanban },
      { href: "/app/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/app/todos", label: "Todos", icon: ListTodo },
      { href: "/app/goals", label: "Goals", icon: Target },
      { href: "/app/calendar", label: "Calendar", icon: Calendar },
      { href: "/app/meetings", label: "Meetings", icon: CalendarDays },
    ],
  },
  {
    label: "Collaborate",
    items: [
      { href: "/app/chat", label: "Chat", icon: MessageSquare },
      { href: "/app/pages", label: "Pages", icon: FileText },
      { href: "/app/files", label: "Files", icon: Files },
      { href: "/app/teams", label: "Teams", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/app/workload", label: "Workload", icon: Gauge },
      { href: "/app/reports", label: "Reports", icon: BarChart3 },
      { href: "/app/risk", label: "Risk", icon: TriangleAlert },
      { href: "/app/activity", label: "Activity", icon: Activity },
      { href: "/app/automations", label: "Automations", icon: Zap },
    ],
  },
];

export const ADMIN_GROUP: NavGroup = {
  label: "Admin",
  items: [{ href: "/app/users", label: "Users", icon: ShieldUser }],
};

export const SETTINGS_ITEM: NavItem = {
  href: "/app/settings",
  label: "Settings",
  icon: Settings,
};

export const CREATE_ITEMS: Array<{
  type: CreateDialogType;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}> = [
  { type: "task", label: "New task", icon: CheckSquare },
  { type: "project", label: "New project", icon: FolderKanban },
  { type: "meeting", label: "New meeting", icon: CalendarDays },
  { type: "todo", label: "New todo", icon: ListTodo },
  { type: "goal", label: "New goal", icon: Target },
];

export function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navGroupsFor(isSystemAdmin: boolean) {
  return isSystemAdmin ? [...NAV, ADMIN_GROUP] : NAV;
}

/** Best nav match for a path (longest href wins). */
export function matchNav(pathname: string, groups: NavGroup[]) {
  const items = [...groups.flatMap((group) => group.items), SETTINGS_ITEM];
  return items
    .filter((item) => isActive(pathname, item.href, item.exact))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
