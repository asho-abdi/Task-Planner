import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckSquare,
  Command,
  FolderKanban,
  Gauge,
  Lock,
  MessageSquare,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { ProductPreview } from "@/components/marketing/product-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: CheckSquare,
    title: "Tasks with a real path",
    body: "Start, submit, review, complete. Status follows the work instead of a checkbox you forget to tick.",
  },
  {
    icon: FolderKanban,
    title: "Projects that hold the rest",
    body: "Board, timeline, files, meetings, chat and notes live on the project itself.",
  },
  {
    icon: CalendarDays,
    title: "Meetings that leave a trail",
    body: "Agendas, RSVPs, notes and decisions. Action items turn into tasks in one click.",
  },
  {
    icon: Gauge,
    title: "Workload you can see",
    body: "Spot who's overloaded this week before you assign one more thing.",
  },
  {
    icon: Target,
    title: "Goals tied to delivery",
    body: "Link goals to projects and tasks so progress is measured, not guessed.",
  },
  {
    icon: BarChart3,
    title: "Reports and risk",
    body: "Throughput, overdue trends and at-risk projects — ready before the status meeting.",
  },
];

const STEPS = [
  {
    title: "Create a workspace",
    body: "One per company, client or team. Each keeps its own people, files and deadlines.",
  },
  {
    title: "Invite by role",
    body: "Owners, admins, members and viewers. Invitations expire after seven days.",
  },
  {
    title: "Plan the day, ship the work",
    body: "My Day shows what's due, what's late and what's next — across every project.",
  },
];

const ROLES = [
  { role: "Owner", detail: "Workspace settings and every permission" },
  { role: "Admin", detail: "Invite people, manage projects and teams" },
  { role: "Member", detail: "Create and deliver work" },
  { role: "Viewer", detail: "Read-only visibility for stakeholders" },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-lg text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-toast rounded-md bg-card px-3 py-2 text-base shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-header border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {[
              ["Features", "#features"],
              ["How it works", "#how-it-works"],
              ["Workspaces", "#workspaces"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-md px-3 py-1.5 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
            >
              Sign in
            </Link>
            <Link href="/register" className={buttonVariants({ size: "sm" })}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="surface-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
          />
          <div
            aria-hidden
            className="absolute left-1/2 top-[-240px] size-[640px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
          />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground"
              >
                <Sparkles className="size-3.5 text-primary" />
                Multi-workspace planning for teams
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <h1 className="mt-6 font-heading text-5xl font-semibold tracking-[-0.04em] text-foreground sm:text-6xl">
                See the day.
                <br />
                <span className="text-primary">Finish the work.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
                Tasks, meetings and project progress sit side by side. Each
                workspace stays its own house — people, files and deadlines
                included.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/register" className={cn(buttonVariants({ size: "xl" }), "w-full sm:w-auto")}>
                  Create a workspace
                  <ArrowRight />
                </Link>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full sm:w-auto")}
                >
                  I already have an account
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {["Role-based access", "Realtime chat", "Dark mode included"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-success" strokeWidth={3} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto mt-14 max-w-4xl">
              <div
                aria-hidden
                className="absolute -inset-x-10 -bottom-10 top-10 rounded-[2rem] bg-primary/10 blur-3xl"
              />
              <ProductPreview className="relative" />
              <div className="absolute -right-3 top-1/3 hidden animate-slide-up rounded-xl border border-border bg-popover p-3 shadow-lg md:block">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success-soft-foreground">
                    <Check className="size-4" strokeWidth={2.5} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Review approved</p>
                    <p className="text-xs text-muted-foreground">Website redesign · just now</p>
                  </div>
                </div>
              </div>
              <div className="absolute -left-4 bottom-10 hidden rounded-xl border border-border bg-popover px-3 py-2 shadow-lg md:flex md:items-center md:gap-2">
                <Command className="size-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Jump anywhere</span>
                <Kbd>Ctrl K</Kbd>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-border bg-card/50 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionHeading
              eyebrow="Features"
              title="Everything the week needs, nothing it doesn't."
              description="One place for the plan and the proof it happened — without stitching five tools together."
            />
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group bg-card p-6 transition-colors duration-200 hover:bg-muted/60 sm:p-7"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary shadow-xs transition-transform duration-200 group-hover:-translate-y-0.5">
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <h3 className="mt-5 text-md font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-2 text-base text-muted-foreground">{feature.body}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Also included:</span>
              {[
                { icon: MessageSquare, label: "Channels & DMs" },
                { icon: Bell, label: "Smart notifications" },
                { icon: Users, label: "Teams" },
                { icon: Sparkles, label: "Automations" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
                >
                  <Icon className="size-3.5" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionHeading
              eyebrow="How it works"
              title="From sign-up to a shared plan in minutes."
              className="mx-auto text-center"
            />
            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl border border-border bg-card p-6 shadow-xs">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary font-heading text-base font-semibold text-primary-foreground tabular">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-md font-semibold">{step.title}</h3>
                  <p className="mt-2 text-base text-muted-foreground">{step.body}</p>
                  {index < STEPS.length - 1 ? (
                    <ArrowRight
                      aria-hidden
                      className="absolute -right-5 top-1/2 hidden size-4 -translate-y-1/2 text-subtle-foreground md:block"
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Workspaces / roles */}
        <section id="workspaces" className="scroll-mt-20 px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-6 py-12 text-ink-foreground sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="absolute -right-32 -top-32 size-[420px] rounded-full bg-primary/40 blur-[120px]"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-ink-accent">
                  <Lock className="size-3.5" />
                  Isolation by design
                </p>
                <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  One company, many rooms.
                </h2>
                <p className="mt-4 max-w-md text-lg text-ink-muted">
                  Keep clients, squads or departments in separate workspaces.
                  Nothing leaks across the wall — every request is checked
                  against your membership.
                </p>
                <Link
                  href="/register"
                  className={cn(buttonVariants({ size: "lg" }), "mt-8")}
                >
                  Start a workspace
                  <ArrowRight />
                </Link>
              </div>
              <ul className="divide-y divide-ink-border overflow-hidden rounded-2xl border border-ink-border bg-ink-foreground/5">
                {ROLES.map((item) => (
                  <li key={item.role} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="font-medium">{item.role}</span>
                    <span className="text-right text-base text-ink-muted">{item.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2 className="font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Open it in the morning. Trust it all day.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Set up your first workspace now — invite the team when you&apos;re ready.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className={buttonVariants({ size: "xl" })}>
                Get started
                <ArrowRight />
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "xl" })}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Plan it. Track it. Keep the rooms separate.
          </p>
        </div>
      </footer>
    </div>
  );
}
