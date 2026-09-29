"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const indicatorVariants = cva("h-full rounded-full transition-[width] duration-500 ease-out", {
  variants: {
    tone: {
      primary: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-danger",
      info: "bg-info",
    },
  },
  defaultVariants: { tone: "primary" },
});

function Progress({
  className,
  value,
  tone,
  size = "default",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> &
  VariantProps<typeof indicatorVariants> & { size?: "sm" | "default" | "lg" }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root
      value={clamped}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1" : size === "lg" ? "h-2.5" : "h-1.5",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={indicatorVariants({ tone })}
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

/** Tone that matches how far along something is. */
function progressTone(value: number) {
  if (value >= 100) return "success" as const;
  return "primary" as const;
}

/** Circular progress ring for compact KPI displays. */
function ProgressRing({
  value,
  size = 40,
  stroke = 4,
  className,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            clamped >= 100 ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center text-2xs font-semibold tabular">
          {children}
        </span>
      ) : null}
    </div>
  );
}

export { Progress, ProgressRing, progressTone };
