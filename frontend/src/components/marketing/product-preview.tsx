import {
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TASKS = [
  { title: "Ship review notes", project: "Website", due: "Today", status: "In progress", tone: "info", done: false },
  { title: "Prep sprint planning", project: "Ops", due: "10:00", status: "Assigned", tone: "default", done: false },
  { title: "Fix onboarding copy", project: "Launch", due: "Overdue", status: "Overdue", tone: "danger", done: false },
  { title: "Approve hero designs", project: "Website", due: "Yesterday", status: "Completed", tone: "success", done: true },
] as const;

const TONE: Record<string, string> = {
  info: "bg-info-soft text-info-soft-foreground",
  default: "bg-muted text-muted-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
};

/**
 * Static, decorative miniature of the product (built from real tokens so it
 * matches the app in both themes). Hidden from assistive tech.
 */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none select-none overflow-hidden rounded-2xl border border-border bg-background shadow-lg",
        className,
      )}
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-card px-3">
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="mx-auto h-4 w-40 rounded bg-muted" />
      </div>
      <div className="flex">
        <div className="hidden w-36 shrink-0 space-y-1 border-r border-sidebar-border bg-sidebar p-2 sm:block">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span className="size-4 rounded bg-primary" />
            <span className="h-2 w-16 rounded bg-border-strong" />
          </div>
          {[LayoutDashboard, Sun, FolderKanban, CheckSquare, CalendarDays, MessageSquare].map(
            (Icon, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-1.5 rounded px-1.5 py-1",
                  index === 1 && "bg-sidebar-active shadow-xs ring-1 ring-sidebar-border",
                )}
              >
                <Icon className={cn("size-3", index === 1 ? "text-primary" : "text-sidebar-muted")} />
                <span className={cn("h-1.5 rounded bg-border-strong", index % 2 ? "w-12" : "w-16")} />
              </div>
            ),
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div>
            <p className="text-2xs font-medium uppercase tracking-wider text-subtle-foreground">
              Tuesday
            </p>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Good morning, Amina
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Open", value: "12", bar: "w-2/3 bg-primary" },
              { label: "Overdue", value: "2", bar: "w-1/5 bg-danger" },
              { label: "Done", value: "18", bar: "w-4/5 bg-success" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-card p-2">
                <p className="text-3xs text-muted-foreground">{stat.label}</p>
                <p className="font-heading text-base font-semibold text-foreground tabular">
                  {stat.value}
                </p>
                <div className="mt-1 h-1 rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", stat.bar)} />
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {TASKS.map((task) => (
              <div
                key={task.title}
                className="flex items-center gap-2 border-b border-border px-2.5 py-2 last:border-0"
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                    task.done ? "border-success bg-success" : "border-border-strong",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-xs font-medium",
                      task.done ? "text-subtle-foreground line-through" : "text-foreground",
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="block text-3xs text-muted-foreground">
                    {task.project} · {task.due}
                  </span>
                </span>
                <span className={cn("rounded-full px-1.5 py-px text-3xs font-medium", TONE[task.tone])}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
