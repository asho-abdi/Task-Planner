import { CircleAlert, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Icon + message + optional action. Use whenever a list or panel has nothing to show. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-xs",
          compact ? "size-9" : "size-11",
        )}
      >
        <Icon className={compact ? "size-4" : "size-5"} strokeWidth={1.75} />
      </div>
      <div className="space-y-1">
        <p className={cn("font-medium text-foreground", compact ? "text-base" : "text-md")}>
          {title}
        </p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/** Inline error panel with an optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-danger-soft-foreground",
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-base font-medium">{title}</p>
        {description ? <p className="text-sm opacity-90">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
