import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatCard as BaseStatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* KPI tiles                                                                   */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return <BaseStatCard label={label} value={value} hint={hint} />;
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
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground tabular">
        {value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        {change ? (
          <span
            className={cn(
              "font-medium tabular",
              change.up ? "text-success-soft-foreground" : "text-danger-soft-foreground",
            )}
          >
            {change.up ? "↑" : "↓"} {change.percent}%
          </span>
        ) : null}
        {hint ? <span className="text-subtle-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Meter                                                                       */
/* -------------------------------------------------------------------------- */

export type MeterTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

const METER_TONE: Record<MeterTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  muted: "bg-subtle-foreground",
};

/** Tone for a utilisation percentage (0–100+). */
export function utilizationTone(percent: number, overloaded?: boolean): MeterTone {
  if (overloaded || percent >= 100) return "danger";
  if (percent >= 80) return "warning";
  return "success";
}

export function Meter({
  value,
  danger,
  className,
  tone,
  label,
}: {
  value: number;
  danger?: boolean;
  className?: string;
  /** Optional fill tone; `danger` wins when set. */
  tone?: MeterTone;
  /** Accessible name for the bar. */
  label?: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  const fill = danger ? "danger" : (tone ?? "primary");
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          METER_TONE[fill],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Lists                                                                       */
/* -------------------------------------------------------------------------- */

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
        <h2 className="text-md font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground tabular">
          {total}
        </span>
      </div>
      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
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
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <p className="truncate text-base font-medium text-foreground">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{meta}</p>
      </div>
      {aside ? <StatusBadge value={aside} /> : null}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Chart primitives                                                            */
/* -------------------------------------------------------------------------- */

type LegendItem = {
  label: string;
  color: string;
  value?: ReactNode;
  /** Share of the total, 0–100. Rendered after the value when given. */
  percent?: number;
};

/** Swatch + label + value legend shared by every chart. */
export function ChartLegend({
  items,
  layout = "inline",
  className,
}: {
  items: LegendItem[];
  layout?: "inline" | "stacked";
  className?: string;
}) {
  return (
    <ul
      className={cn(
        layout === "inline"
          ? "flex flex-wrap items-center gap-x-4 gap-y-1.5"
          : "space-y-1.5",
        "text-xs",
        className,
      )}
    >
      {items.map((item) => (
        <li
          key={item.label}
          className={cn(
            "flex items-center gap-2",
            layout === "stacked" && "justify-between",
          )}
        >
          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: item.color }}
            />
            <span className="truncate">{item.label}</span>
          </span>
          {item.value !== undefined || item.percent !== undefined ? (
            <span className="shrink-0 font-medium text-foreground tabular">
              {item.value}
              {item.percent !== undefined ? (
                <span className="ml-1.5 font-normal text-subtle-foreground">
                  {item.percent}%
                </span>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value && (candidate / 4) % 1 === 0) return candidate;
  }
  return Math.ceil(value / 4) * 4;
}

export function DonutChart({
  total,
  slices,
  label = "tasks",
}: {
  total: number;
  slices: Array<{ label: string; count: number; color: string }>;
  /** Caption under the centre number. */
  label?: string;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const visible = slices.filter((slice) => slice.count > 0);
  const gap = visible.length > 1 ? 2 : 0;
  // Pure offset computation: each arc starts where the previous ones end.
  const arcs = visible.map((slice, index) => {
    const start = visible
      .slice(0, index)
      .reduce((sum, item) => sum + (total ? (item.count / total) * c : 0), 0);
    const len = total ? (slice.count / total) * c : 0;
    return { ...slice, start, len: Math.max(0, len - gap) };
  });
  const summary = `${total} ${label}: ${visible
    .map((slice) => `${slice.label} ${slice.count}`)
    .join(", ")}`;

  return (
    <div className="relative mx-auto size-44 shrink-0">
      <svg
        viewBox="0 0 140 140"
        className="group size-full -rotate-90"
        role="img"
        aria-label={summary}
      >
        <title>{summary}</title>
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          style={{ stroke: "var(--muted)" }}
          strokeWidth="16"
        />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            style={{ stroke: arc.color }}
            strokeWidth="16"
            strokeDasharray={`${arc.len} ${c - arc.len}`}
            strokeDashoffset={-arc.start}
            className="transition-opacity duration-150 group-hover:opacity-40 hover:opacity-100!"
          >
            <title>
              {`${arc.label}: ${arc.count} (${total ? Math.round((arc.count / total) * 100) : 0}%)`}
            </title>
          </circle>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-heading text-2xl font-semibold tracking-[-0.02em] text-foreground tabular">
          {total}
        </p>
        <p className="text-2xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Time series chart. Renders lines (default) or grouped bars with rounded
 * tops. Drawn with HTML + a stretched SVG so axis text stays crisp at any width.
 */
export function TrendChart({
  labels,
  series,
  variant = "line",
  ariaLabel,
  showLegend = true,
}: {
  labels: string[];
  series: Array<{ label: string; values: number[]; color: string }>;
  variant?: "line" | "bar";
  ariaLabel?: string;
  showLegend?: boolean;
}) {
  const count = labels.length;
  const rawMax = Math.max(0, ...series.flatMap((item) => item.values));
  const max = niceMax(rawMax);
  const ticks = [max, (max * 3) / 4, max / 2, max / 4, 0];
  const x = (index: number) => (count ? ((index + 0.5) / count) * 100 : 50);
  const y = (value: number) => 100 - (value / max) * 100;
  const path = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`)
      .join(" ");
  const area = (values: number[]) =>
    values.length
      ? `${path(values)} L ${x(values.length - 1)} 100 L ${x(0)} 100 Z`
      : "";
  const labelEvery = Math.max(1, Math.ceil(count / 6));
  const totals = series.map((item) => item.values.reduce((sum, v) => sum + v, 0));
  const summary =
    ariaLabel ??
    `${series.map((item, index) => `${item.label} ${totals[index]}`).join(", ")} across ${count} periods`;

  return (
    <figure className="space-y-3">
      <div role="img" aria-label={summary} className="flex gap-2">
        <div
          aria-hidden
          className="flex h-48 w-7 shrink-0 flex-col justify-between text-right text-2xs text-muted-foreground tabular"
        >
          {ticks.map((tick) => (
            <span key={tick} className="-my-2 leading-4">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48">
            {ticks.map((tick, index) => (
              <div
                key={tick}
                aria-hidden
                className={cn(
                  "absolute inset-x-0 border-t",
                  index === ticks.length - 1 ? "border-border-strong" : "border-dashed border-border",
                )}
                style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
              />
            ))}

            {variant === "line" ? (
              <svg
                aria-hidden
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 size-full overflow-visible"
              >
                {series.map((item) => (
                  <g key={item.label}>
                    <path d={area(item.values)} style={{ fill: item.color, opacity: 0.08 }} />
                    <path
                      d={path(item.values)}
                      fill="none"
                      style={{ stroke: item.color }}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
              </svg>
            ) : (
              <div aria-hidden className="absolute inset-0 flex items-end">
                {labels.map((label, index) => (
                  <div
                    key={`${label}-${index}`}
                    className="flex h-full flex-1 items-end justify-center gap-0.5 px-[12%]"
                  >
                    {series.map((item) => (
                      <div
                        key={item.label}
                        className="w-full max-w-4 rounded-t-sm transition-opacity duration-150"
                        style={{
                          height: `${((item.values[index] ?? 0) / max) * 100}%`,
                          minHeight: (item.values[index] ?? 0) > 0 ? 2 : 0,
                          background: item.color,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Hover columns: highlight + tooltip with every series value. */}
            <div className="absolute inset-0 flex">
              {labels.map((label, index) => {
                const align =
                  index < count / 4 ? "left-0" : index > (count * 3) / 4 ? "right-0" : "left-1/2 -translate-x-1/2";
                return (
                  <div key={`${label}-${index}`} className="group/col relative h-full flex-1">
                    <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-border-strong group-hover/col:block" />
                    {variant === "line"
                      ? series.map((item) => (
                          <span
                            key={item.label}
                            className="absolute left-1/2 hidden size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card group-hover/col:block"
                            style={{
                              top: `${y(item.values[index] ?? 0)}%`,
                              background: item.color,
                            }}
                          />
                        ))
                      : null}
                    <div
                      className={cn(
                        "pointer-events-none absolute -top-2 z-10 hidden min-w-32 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md group-hover/col:block",
                        align,
                      )}
                    >
                      <p className="mb-1 font-medium">{label}</p>
                      {series.map((item) => (
                        <p key={item.label} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-sm" style={{ background: item.color }} />
                            {item.label}
                          </span>
                          <span className="font-medium tabular">{item.values[index] ?? 0}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div aria-hidden className="relative mt-2 h-4 text-2xs text-muted-foreground">
            {labels.map((label, index) =>
              index % labelEvery === 0 ? (
                <span
                  key={`${label}-${index}`}
                  className={cn(
                    "absolute top-0 -translate-x-1/2 whitespace-nowrap",
                    (index / labelEvery) % 2 === 1 && "max-sm:hidden",
                  )}
                  style={{ left: `${x(index)}%` }}
                >
                  {label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      {showLegend ? (
        <ChartLegend
          className="pl-9"
          items={series.map((item, index) => ({
            label: item.label,
            color: item.color,
            value: totals[index],
          }))}
        />
      ) : null}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((item) => (
              <th key={item.label} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={`${label}-${index}`}>
              <th scope="row">{label}</th>
              {series.map((item) => (
                <td key={item.label}>{item.values[index] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars with label + value; values stay readable as text. */
export function BarList({
  items,
  total,
  className,
}: {
  items: Array<{ label: ReactNode; key: string; value: number; color?: string; href?: string }>;
  /** Denominator for bar widths; defaults to the largest value. */
  total?: number;
  className?: string;
}) {
  const denom = Math.max(1, total ?? Math.max(0, ...items.map((item) => item.value)));
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => {
        const width = Math.round((item.value / denom) * 100);
        const style: CSSProperties = {
          width: `${width}%`,
          background: item.color ?? "var(--chart-1)",
        };
        const label = item.href ? (
          <Link
            href={item.href}
            className="truncate rounded-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.label}
          </Link>
        ) : (
          <span className="truncate text-foreground">{item.label}</span>
        );
        return (
          <li key={item.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              {label}
              <span className="shrink-0 text-muted-foreground tabular">
                {item.value}
                {total ? (
                  <span className="ml-1.5 text-subtle-foreground">
                    {Math.round((item.value / Math.max(1, total)) * 100)}%
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={style}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

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
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted-foreground tabular">
        Page <span className="font-medium text-foreground">{page}</span> of {pageCount}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
