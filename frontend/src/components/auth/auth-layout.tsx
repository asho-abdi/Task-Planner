import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { ProductPreview } from "@/components/marketing/product-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  "Projects, tasks, meetings and chat in one workspace",
  "Owner, admin, member and viewer roles — by design",
  "Invites expire in seven days, not forever",
];

/**
 * Split auth layout: form on the left, brand panel on the right (lg+).
 * The panel uses the always-dark "ink" surface in both themes.
 */
export function AuthLayout({
  eyebrow,
  panelTitle,
  panelDescription,
  children,
}: {
  eyebrow?: string;
  panelTitle: string;
  panelDescription?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-slide-up">{children}</div>
        </div>
        <p className="text-center text-xs text-subtle-foreground lg:text-left">
          © {new Date().getFullYear()} Task Planner · Plan it. Track it. Keep the rooms separate.
        </p>
      </section>

      <aside className="relative hidden overflow-hidden bg-ink text-ink-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,var(--ink-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--ink-border)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-[420px] rounded-full bg-primary/40 blur-[120px]"
        />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-accent">
            {eyebrow ?? "Workspaces"}
          </p>
          <h2 className="mt-4 max-w-md font-heading text-4xl font-semibold tracking-[-0.03em] text-ink-foreground">
            {panelTitle}
          </h2>
          {panelDescription ? (
            <p className="mt-4 max-w-sm text-md text-ink-muted">{panelDescription}</p>
          ) : null}
        </div>

        <div className="relative my-10">
          <ProductPreview className="w-[112%] max-w-none -rotate-1 border-ink-border" />
        </div>

        <ul className="relative space-y-3">
          {HIGHLIGHTS.map((text) => (
            <li key={text} className="flex items-center gap-3 text-base text-ink-muted">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/25 text-ink-accent">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h1>
      {description ? <p className="text-md text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function AuthCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AuthShowcase({
  children,
}: {
  brand?: string;
  children: ReactNode;
}) {
  return (
    <AuthLayout
      eyebrow="Welcome back"
      panelTitle="See the day. Finish the work."
      panelDescription="Sign in to the workspace you left — tasks, meetings, and projects stay put."
    >
      {children}
    </AuthLayout>
  );
}
