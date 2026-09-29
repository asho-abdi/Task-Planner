import Link from "next/link";
import type { ReactNode } from "react";
import { Instrument_Serif } from "next/font/google";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const HIGHLIGHTS = [
  { n: "01", text: "Projects, tasks, and meetings stay in one workspace." },
  { n: "02", text: "Owners, admins, members, and viewers — by design." },
  { n: "03", text: "Invites expire in seven days, not forever." },
];

export const authFieldClass =
  "h-11 rounded-md border-[#E7E2D9] bg-white shadow-none placeholder:text-[#A8A29A] focus-visible:border-[#635BFF] focus-visible:ring-[#635BFF]/20";

export const authLineField =
  "h-10 w-full rounded-none border-0 border-b border-[#D8DEE9] bg-transparent px-0 text-[15px] font-medium text-[#1F2937] shadow-none placeholder:font-medium placeholder:text-[#111827] focus-visible:border-[#2D3766] focus-visible:outline-none focus-visible:ring-0";

export function AuthBrandLink() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative h-7 w-8 shrink-0">
        <span className="absolute left-0 top-0 h-5 w-5 rounded-[3px] bg-[#635BFF]" />
        <span className="absolute bottom-0 right-0 h-5 w-5 rounded-[3px] bg-[#8B83FF]/90" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-[#1F2937]">
        Task Planner and Tracker
      </span>
    </Link>
  );
}

export function AuthRocketPanel() {
  return (
    <div className="absolute inset-0">
      <span className="absolute left-[18%] top-[22%] h-2 w-2 rotate-45 bg-[#F4C6D7]" />
      <span className="absolute right-[22%] top-[18%] h-2.5 w-2.5 rotate-45 bg-[#7EDDD3]" />
      <span className="absolute right-[16%] top-[38%] h-2 w-2 rotate-45 bg-[#F5D76E]" />
      <span className="absolute left-[12%] top-[48%] h-1.5 w-1.5 rotate-45 bg-[#94A3B8]" />
      <span className="absolute right-[28%] top-[58%] h-2 w-2 rotate-45 bg-[#F4C6D7]" />
      <span className="absolute left-[24%] top-[16%] h-px w-5 rotate-[30deg] bg-white/50" />
      <span className="absolute right-[18%] top-[48%] h-px w-4 -rotate-[20deg] bg-white/40" />
      <span className="absolute left-[14%] top-[36%] h-1 w-1 rounded-full bg-white/70" />
      <span className="absolute right-[30%] top-[28%] h-1 w-1 rounded-full bg-white/60" />

      <svg
        viewBox="0 0 280 360"
        className="absolute left-1/2 top-[18%] h-[58%] w-auto -translate-x-1/2"
        aria-hidden
      >
        <ellipse cx="140" cy="300" rx="28" ry="10" fill="#1A2248" opacity="0.35" />
        <path d="M118 268 L140 330 L162 268 Z" fill="#F4A261" />
        <path d="M128 268 L140 312 L152 268 Z" fill="#E76F51" />
        <path d="M140 42 C96 118 96 188 140 248 C184 188 184 118 140 42 Z" fill="#5B7CFF" />
        <path d="M140 58 C112 122 112 186 140 234 C168 186 168 122 140 58 Z" fill="#7B93FF" />
        <circle cx="140" cy="132" r="22" fill="#D6EEF7" />
        <circle cx="140" cy="132" r="14" fill="#7EC8E3" />
        <circle cx="134" cy="126" r="5" fill="white" opacity="0.7" />
        <path d="M96 188 L70 230 L118 214 Z" fill="#635BFF" />
        <path d="M184 188 L210 230 L162 214 Z" fill="#8B83FF" />
        <rect x="132" y="248" width="16" height="18" rx="3" fill="#3D4A7A" />
      </svg>

      <svg
        className="absolute inset-x-0 bottom-0 h-[28%] w-full"
        viewBox="0 0 600 180"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill="white"
          d="M0 110 C80 70 140 150 220 100 C300 50 360 140 450 90 C520 55 560 80 600 70 L600 180 L0 180 Z"
        />
        <path
          fill="white"
          opacity="0.9"
          d="M0 130 C90 100 160 160 250 120 C340 80 400 150 500 115 C560 95 580 110 600 108 L600 180 L0 180 Z"
        />
      </svg>
    </div>
  );
}

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
    <div className="min-h-full bg-[#F6F4EF] text-[#172033]">
      <header className="border-b border-[#E7E2D9]/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#635BFF] text-[10px] font-semibold tracking-wide text-white">
              TPT
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Task Planner and Tracker
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-[#6B6358] transition-colors hover:text-[#172033]"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-2">
        <section className="flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </section>

        <aside className="relative hidden flex-col justify-between bg-[#0B1220] px-12 py-14 text-[#E8EDF5] lg:flex">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#9AA7B8]">
              {eyebrow ?? "Workspaces"}
            </p>
            <h1
              className={`${display.className} mt-5 max-w-md text-[2.75rem] leading-[1.05] text-white`}
            >
              {panelTitle}
            </h1>
            {panelDescription ? (
              <p className="mt-5 max-w-sm text-[15px] leading-7 text-[#B7C2D0]">
                {panelDescription}
              </p>
            ) : null}
          </div>
          <ul className="space-y-5 border-t border-white/10 pt-8">
            {HIGHLIGHTS.map((item) => (
              <li key={item.n} className="flex gap-4 text-sm leading-6">
                <span className="tabular-nums text-[#7C8A9A]">{item.n}</span>
                <span className="text-[#C5CED8]">{item.text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </main>
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
        "rounded-2xl border border-[#E7E2D9] bg-white p-6 sm:p-8",
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
