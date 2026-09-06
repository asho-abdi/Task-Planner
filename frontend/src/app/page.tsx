import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative min-h-full overflow-hidden bg-sidebar text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-10 px-6 py-20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-semibold">
            TPT
          </div>
          <p className="text-sm font-semibold tracking-tight">
            Task Planner and Tracker
          </p>
        </div>
        <div className="max-w-2xl space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200">
            Multi-workspace planning
          </p>
          <h1 className="text-5xl font-semibold tracking-tight">
            Plan work across teams without losing the workspace boundary.
          </h1>
          <p className="max-w-xl text-base leading-7 text-slate-300">
            Projects, tasks, meetings, and goals in one professional workspace.
            Invite people by role and keep every team in its own tenant.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">Get started</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
