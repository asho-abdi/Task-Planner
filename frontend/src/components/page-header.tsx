import { ArrowDownRight, ArrowUpRight, ChevronLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { EmptyState as EmptyStateBase } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function PageShell({
  className,
  children,
  width = "default",
}: {
  className?: string;
  children: ReactNode;
  width?: "default" | "wide" | "narrow" | "full";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 animate-slide-up",
        width === "default" && "max-w-[1200px]",
        width === "wide" && "max-w-[1440px]",
        width === "narrow" && "max-w-3xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  breadcrumbs,
  icon: Icon,
  meta,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItem[];
  icon?: LucideIcon;
  /** Small row under the description (badges, counts, owners). */
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        {breadcrumbs?.length ? (
          <Breadcrumbs items={breadcrumbs} />
        ) : backHref ? (
          <Link
            href={backHref}
            className="-ml-1 inline-flex items-center gap-0.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-4" />
            {backLabel ?? "Back"}
          </Link>
        ) : null}
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs sm:flex">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
          ) : null}
          <h1 className="min-w-0 truncate font-heading text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>
        {description ? (
          <div className="max-w-2xl text-md text-muted-foreground">{description}</div>
        ) : null}
        {meta ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  description,
}: {
  children: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-md font-semibold tracking-[-0.01em] text-foreground">
          {children}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  compact?: boolean;
  className?: string;
}) {
  return (
    <EmptyStateBase
      title={title}
      description={description}
      action={action}
      icon={icon}
      compact={compact}
      className={className}
    />
  );
}

export function Surface({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ListPanel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** KPI tile: label, big number, optional delta and hint. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  tone = "default",
  href,
  className,
  invertDelta = false,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  /** Percentage change; positive renders as an increase. */
  delta?: number | null;
  tone?: "default" | "primary" | "success" | "warning" | "danger" | "info";
  href?: string;
  className?: string;
  /** Treat increases as bad (e.g. overdue counts): colours flip, arrows don't. */
  invertDelta?: boolean;
}) {
  const toneClass = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary-soft text-primary-soft-foreground",
    success: "bg-success-soft text-success-soft-foreground",
    warning: "bg-warning-soft text-warning-soft-foreground",
    danger: "bg-danger-soft text-danger-soft-foreground",
    info: "bg-info-soft text-info-soft-foreground",
  }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", toneClass)}>
            <Icon className="size-4" strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground tabular">
          {value}
        </p>
        {typeof delta === "number" && Number.isFinite(delta) ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular",
              (delta >= 0) !== invertDelta
                ? "text-success-soft-foreground"
                : "text-danger-soft-foreground",
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(Math.round(delta))}%
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </>
  );

  const classes = cn(
    "block rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5",
    href &&
      "transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Coming in a later phase"
        description="This area is reserved so the workspace navigation stays complete. Existing work in Projects, Tasks, and Meetings is unchanged."
      />
    </PageShell>
  );
}
