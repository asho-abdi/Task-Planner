import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="font-heading mt-2 text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] font-medium text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Meter({
  value,
  danger,
  className,
}: {
  value: number;
  danger?: boolean;
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-200",
          danger ? "bg-destructive" : "bg-primary",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function InsightSection({
  title,
  total,
  empty,
  children,
}: {
  title: string;
  total: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="text-[13px] font-medium text-muted-foreground">{total}</p>
      </div>
      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {children}
        </div>
      )}
    </section>
  );
}

export function workloadGlyph(percent: number) {
  const filled = Math.min(10, Math.max(0, Math.round(percent / 10)));
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

export function InsightRow({
  href,
  title,
  meta,
  aside,
}: {
  href: string;
  title: string;
  meta: string;
  aside?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{meta}</p>
      </div>
      {aside ? <StatusBadge value={aside} /> : null}
    </Link>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  change,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  change?: { percent: number; up: boolean } | null;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-primary">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="font-heading mt-2 text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em] text-foreground">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {change ? (
          <span
            className={cn(
              "text-[12px] font-medium",
              change.up ? "text-success" : "text-danger",
            )}
          >
            {change.up ? "↑" : "↓"} {change.percent}%
          </span>
        ) : null}
        {hint ? (
          <span className="text-[12px] text-subtle-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

export function DonutChart({
  total,
  slices,
}: {
  total: number;
  slices: Array<{ label: string; count: number; color: string }>;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const visible = slices.filter((slice) => slice.count > 0);
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 140 140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          style={{ stroke: "var(--muted)" }}
          strokeWidth="16"
        />
        {visible.map((slice) => {
          const len = total ? (slice.count / total) * c : 0;
          const circle = (
            <circle
              key={slice.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              style={{ stroke: slice.color }}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[22px] font-semibold tracking-tight text-foreground">
          {total}
        </p>
        <p className="text-[11px] text-subtle-foreground">tasks</p>
      </div>
    </div>
  );
}

export function TrendChart({
  labels,
  series,
}: {
  labels: string[];
  series: Array<{ label: string; values: number[]; color: string }>;
}) {
  const width = 640;
  const height = 220;
  const pad = { l: 28, r: 12, t: 16, b: 28 };
  const max = Math.max(1, ...series.flatMap((item) => item.values));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (index: number) =>
    pad.l +
    (labels.length <= 1 ? innerW / 2 : (index / (labels.length - 1)) * innerW);
  const y = (value: number) => pad.t + innerH - (value / max) * innerH;
  const path = (values: number[]) =>
    values
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`,
      )
      .join(" ");
  const area = (values: number[]) => {
    if (!values.length) return "";
    return `${path(values)} L ${x(values.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
      {[0.25, 0.5, 0.75, 1].map((tick) => (
        <line
          key={tick}
          x1={pad.l}
          x2={width - pad.r}
          y1={y(max * tick)}
          y2={y(max * tick)}
          style={{ stroke: "var(--border)" }}
          strokeDasharray="4 6"
        />
      ))}
      {series.map((item) => (
        <g key={item.label}>
          <path d={area(item.values)} style={{ fill: item.color }} opacity="0.08" />
          <path
            d={path(item.values)}
            fill="none"
            style={{ stroke: item.color }}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      ))}
      {labels.map((label, index) =>
        index === 0 ||
        index === labels.length - 1 ||
        index === Math.floor(labels.length / 2) ? (
          <text
            key={`${label}-${index}`}
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
            className="fill-subtle-foreground text-[11px]"
          >
            {label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function PageControls({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
