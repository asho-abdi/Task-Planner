"use client";

import { Bell, ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/features/auth/types";
import { useLogout } from "@/features/auth/hooks";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useThemeStore, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<PublicUser["role"], string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Platform admin",
  MEMBER: "Member",
};

export function UserMenu({
  user,
  collapsed,
  onNavigate,
}: {
  user: PublicUser;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const logout = useLogout();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  const trigger = (
    <DropdownMenuTrigger
      aria-label={`Account menu for ${user.name}`}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg text-left outline-none transition-colors",
        "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent",
        collapsed ? "mx-auto size-10 justify-center" : "h-11 px-2",
      )}
    >
      <Avatar name={user.name} size="default" status="online" />
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-medium text-foreground">
              {user.name}
            </span>
            <span className="block truncate text-2xs text-sidebar-muted">{user.email}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted group-hover:text-foreground" />
        </>
      )}
    </DropdownMenuTrigger>
  );

  function go(href: string) {
    onNavigate?.();
    router.push(href);
  }

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip content={user.name} side="right">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "end" : "start"}
        className="w-60"
      >
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="text-2xs text-subtle-foreground">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/app/settings")}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/app/notifications")}>
          <Bell />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {preference === "dark" ? <Moon /> : preference === "light" ? <Sun /> : <Monitor />}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={preference}
              onValueChange={(value) => setPreference(value as ThemePreference)}
            >
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={(event) => {
            event.preventDefault();
            logout.mutate();
          }}
        >
          <LogOut />
          {logout.isPending ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
