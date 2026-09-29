"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useThemeStore, type ThemePreference } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Cycles light → dark → system. Compact icon button for toolbars. */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const index = OPTIONS.findIndex((option) => option.value === preference);
  const current = OPTIONS[index] ?? OPTIONS[2];
  const next = OPTIONS[(index + 1) % OPTIONS.length];
  const Icon = current.icon;

  return (
    <Tooltip content={`Theme: ${current.label}`}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
        onClick={() => setPreference(next.value)}
      >
        <Icon />
      </Button>
    </Tooltip>
  );
}

/** Three-way segmented theme picker for settings and menus. */
export function ThemeSegmented({ className }: { className?: string }) {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = option.value === preference;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => setPreference(option.value)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
