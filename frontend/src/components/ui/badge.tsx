import { cva, type VariantProps } from "class-variance-authority";
import {
  ChevronsUp,
  ChevronUp,
  Equal,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-primary-soft text-primary-soft-foreground",
        info: "bg-info-soft text-info-soft-foreground",
        success: "bg-success-soft text-success-soft-foreground",
        warning: "bg-warning-soft text-warning-soft-foreground",
        danger: "bg-danger-soft text-danger-soft-foreground",
        outline: "border border-border bg-transparent text-muted-foreground",
        solid: "bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const dotTone: Record<string, string> = {
  default: "bg-subtle-foreground",
  primary: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  outline: "bg-subtle-foreground",
  solid: "bg-primary-foreground",
};

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({
  className,
  variant,
  dot,
  children,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", dotTone[variant ?? "default"])}
        />
      ) : null}
      {children}
    </span>
  );
}

export function toneForStatus(status: string) {
  if (
    status === "COMPLETED" ||
    status === "APPROVED" ||
    status === "ACTIVE" ||
    status === "LOW"
  ) {
    return "success" as const;
  }
  if (
    status === "RETURNED" ||
    status === "OVERDUE" ||
    status === "CANCELLED" ||
    status === "URGENT" ||
    status === "CRITICAL"
  ) {
    return "danger" as const;
  }
  if (status === "IN_REVIEW") {
    return "primary" as const;
  }
  if (status === "IN_PROGRESS" || status === "SCHEDULED") {
    return "info" as const;
  }
  if (
    status === "MEDIUM" ||
    status === "HIGH" ||
    status === "PLANNING" ||
    status === "PENDING"
  ) {
    return "warning" as const;
  }
  if (status === "ARCHIVED" || status === "ON_HOLD") return "outline" as const;
  return "default" as const;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: "Assigned",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "Under review",
  COMPLETED: "Completed",
  RETURNED: "Returned",
  OVERDUE: "Overdue",
  ARCHIVED: "Archived",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  NOT_STARTED: "Not started",
};

export function statusLabel(value: string) {
  const label = STATUS_LABELS[value] ?? value.replaceAll("_", " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <Badge variant={toneForStatus(value)} dot className={className}>
      {statusLabel(value)}
    </Badge>
  );
}

const PRIORITY_META: Record<
  string,
  { icon: LucideIcon; variant: BadgeVariant; label: string }
> = {
  URGENT: { icon: ChevronsUp, variant: "danger", label: "Urgent" },
  HIGH: { icon: ChevronUp, variant: "warning", label: "High" },
  MEDIUM: { icon: Equal, variant: "info", label: "Medium" },
  LOW: { icon: ChevronDown, variant: "default", label: "Low" },
};

/** Priority with a directional glyph so it never relies on color alone. */
export function PriorityBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const meta = PRIORITY_META[value];
  if (!meta) return <Badge className={className}>{statusLabel(value)}</Badge>;
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className={className}>
      <Icon aria-hidden strokeWidth={2.5} />
      {meta.label}
    </Badge>
  );
}
