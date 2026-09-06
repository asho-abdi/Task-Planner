import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-600",
        primary: "bg-indigo-50 text-indigo-700",
        info: "bg-blue-50 text-blue-700",
        success: "bg-emerald-50 text-emerald-700",
        warning: "bg-amber-50 text-amber-800",
        danger: "bg-red-50 text-red-700",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
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

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant={toneForStatus(value)}>
      {STATUS_LABELS[value] ?? value.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
