import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto max-w-[1120px] space-y-5", className)}>
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
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-1 inline-block text-[14px] font-medium text-[#64748B] transition-colors hover:text-foreground"
          >
            {backLabel ?? "Back"}
          </Link>
        ) : null}
        <h1 className="font-heading text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#172033] sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <div className="mt-1.5 max-w-xl text-[15px] font-normal leading-[1.5] text-[#64748B]">
            {description}
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
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold leading-[1.25] tracking-[-0.02em] text-[#172033]">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 py-12">
      <p className="text-[18px] font-semibold leading-[1.3] text-[#172033]">{title}</p>
      {description ? (
        <p className="max-w-md text-[15px] font-normal leading-[1.5] text-[#64748B]">
          {description}
        </p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
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
        "rounded-[10px] border border-[#E5E7EB] bg-white p-4 sm:p-5",
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
        "overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white",
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
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold leading-[1.3] transition-colors",
            value === option.value
              ? "bg-white font-bold text-[#172033] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
              : "text-[#64748B] hover:text-[#172033]",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
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
