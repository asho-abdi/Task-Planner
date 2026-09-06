import type { ReactNode } from "react";

const HIGHLIGHTS = [
  "Workspace-scoped projects, tasks, and meetings",
  "Roles for owners, admins, members, and viewers",
  "Invites that expire in seven days",
];

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
    <main className="grid min-h-full lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-sidebar px-10 py-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white">
              TPT
            </div>
            <p className="text-sm font-semibold tracking-tight text-white">
              Task Planner and Tracker
            </p>
          </div>
          <p className="mt-16 text-xs font-medium uppercase tracking-[0.18em] text-indigo-200">
            {eyebrow ?? "Workspaces"}
          </p>
          <h1 className="mt-3 max-w-md text-4xl font-semibold tracking-tight text-white">
            {panelTitle}
          </h1>
          {panelDescription ? (
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              {panelDescription}
            </p>
          ) : null}
        </div>
        <ul className="relative space-y-3 text-sm text-slate-300">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
              {item}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </main>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
      {children}
    </div>
  );
}

export function AuthShowcase({
  brand = "Task Planner and Tracker",
  children,
}: {
  brand?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-full items-center justify-center bg-[#d4e4f6] px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-[1100px] overflow-hidden rounded-[28px] border-[3px] border-[#1d3d6e] bg-white shadow-[0_28px_64px_rgba(29,61,110,0.14)] lg:min-h-[620px] lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section className="flex flex-col px-8 py-10 sm:px-12 sm:py-12">
          <p className="text-[17px] font-bold tracking-tight text-[#111827]">
            {brand}
          </p>
          <div className="flex flex-1 flex-col justify-center pt-12 lg:pt-6">
            {children}
          </div>
        </section>
        <section className="relative hidden bg-[#f4f7fc] lg:block">
          <img
            src="/login-hero.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-contain p-6"
          />
        </section>
      </div>
    </main>
  );
}
