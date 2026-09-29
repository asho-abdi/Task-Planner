import Link from "next/link";
import { cn } from "@/lib/utils";

/** Product mark: two stacked, offset tiles — a plan and the work that follows it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-7 shrink-0", className)}
    >
      <rect x="2" y="2" width="20" height="20" rx="6" className="fill-primary" />
      <rect
        x="10"
        y="10"
        width="20"
        height="20"
        rx="6"
        className="fill-primary/35 stroke-background"
        strokeWidth="2"
      />
      <path
        d="M15.5 20.5l3 3 6-6.5"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  wordmarkClassName,
}: {
  href?: string | null;
  className?: string;
  wordmarkClassName?: string;
}) {
  const content = (
    <>
      <LogoMark />
      <span
        className={cn(
          "font-heading text-lg font-semibold tracking-[-0.02em] text-foreground",
          wordmarkClassName,
        )}
      >
        Task Planner
      </span>
    </>
  );

  if (!href) {
    return <span className={cn("inline-flex items-center gap-2", className)}>{content}</span>;
  }

  return (
    <Link
      href={href}
      aria-label="Task Planner home"
      className={cn(
        "inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {content}
    </Link>
  );
}
