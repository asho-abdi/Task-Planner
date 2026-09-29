import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Users,
} from "lucide-react";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

function Mark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#635BFF] text-[10px] font-semibold tracking-wide text-white ${className}`}
    >
      TPT
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="marketing-page min-h-full bg-[#F6F4EF] text-[#172033]">
      <header className="sticky top-0 z-30 border-b border-[#E7E2D9]/80 bg-[#F6F4EF]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-sm font-semibold tracking-tight">
              Task Planner and Tracker
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#5C6570] md:flex">
            <a href="#work" className="transition-colors hover:text-[#172033]">
              Product
            </a>
            <a href="#rhythm" className="transition-colors hover:text-[#172033]">
              Daily rhythm
            </a>
            <a href="#workspaces" className="transition-colors hover:text-[#172033]">
              Workspaces
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#172033] transition-colors hover:bg-[#EDE9E1]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-[#635BFF] px-3.5 py-2 text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.24)_inset] transition-colors hover:bg-[#5147E8]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-end gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:pb-24 lg:pt-20">
          <div>
            <p className="text-[13px] text-[#6B6358]">
              For teams who share a calendar, not a mess of chats.
            </p>
            <h1
              className={`${display.className} mt-5 max-w-[12ch] text-[3.35rem] leading-[0.95] text-[#172033] sm:text-7xl`}
            >
              See the day. Finish the work.
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-8 text-[#4B5563]">
              Tasks, meetings, and project progress sit next to each other.
              Each workspace stays its own house — people, files, and deadlines
              included.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#635BFF] px-5 text-sm font-medium text-white transition-colors hover:bg-[#5147E8]"
              >
                Create a workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-md border border-[#D9D3C8] bg-transparent px-5 text-sm font-medium text-[#172033] transition-colors hover:bg-white"
              >
                I already have an account
              </Link>
            </div>
            <p className="mt-5 text-xs text-[#8A8278]">
              Owners, admins, members, and viewers — roles stay inside the
              workspace.
            </p>
          </div>

          <ProductPreview />
        </section>

        <section
          id="work"
          className="border-y border-[#E7E2D9] bg-[#FFFDF8]"
        >
          <div className="mx-auto grid max-w-6xl gap-px bg-[#E7E2D9] sm:grid-cols-2 lg:grid-cols-4">
            <Fact
              kicker="01"
              title="My Day"
              body="Today, overdue, and done — in one list, not three apps."
            />
            <Fact
              kicker="02"
              title="Projects"
              body="Board, timeline, files, and notes live on the project itself."
            />
            <Fact
              kicker="03"
              title="Meetings"
              body="Agenda, notes, and action items without a side document."
            />
            <Fact
              kicker="04"
              title="People"
              body="Teams, workload, and who actually owns the next step."
            />
          </div>
        </section>

        <section id="rhythm" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-xl">
            <h2
              className={`${display.className} text-4xl leading-tight sm:text-5xl`}
            >
              A page you open in the morning and trust.
            </h2>
            <p className="mt-4 text-[16px] leading-7 text-[#4B5563]">
              The dashboard answers five questions and then gets out of the
              way.
            </p>
          </div>

          <ol className="mt-12 divide-y divide-[#E7E2D9] border-y border-[#E7E2D9]">
            <RhythmRow n="1" q="What do I need to do?" a="Today’s tasks, with project, priority, and due time." />
            <RhythmRow n="2" q="What meetings do I have?" a="The next few, with online or in-person marked clearly." />
            <RhythmRow n="3" q="What’s coming due?" a="Deadlines for the next two weeks, not a buried calendar." />
            <RhythmRow n="4" q="Which projects are moving?" a="Progress bars and people, not a status meeting." />
            <RhythmRow n="5" q="What happened while I was away?" a="Recent activity, written as it actually occurred." />
          </ol>
        </section>

        <section
          id="workspaces"
          className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="rounded-2xl bg-[#0B1220] px-8 py-10 text-[#E8EDF5] sm:px-10">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#9AA7B8]">
              Isolation
            </p>
            <h2
              className={`${display.className} mt-4 text-4xl leading-tight text-white`}
            >
              One company, many rooms.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[#B7C2D0]">
              Invite by role. Keep clients, squads, or departments in separate
              workspaces. Nothing leaks across the wall.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white"
            >
              Start a workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            <Capability
              icon={CheckSquare}
              title="Tasks with a real path"
              body="Start work, submit, review, then complete. Status isn’t a checkbox you skip."
            />
            <Capability
              icon={FolderKanban}
              title="Projects that hold the rest"
              body="Tasks, files, chat, calendar, and notes stay attached to the project."
            />
            <Capability
              icon={CalendarDays}
              title="Meetings that leave a trail"
              body="Participants RSVP. Notes autosave. Action items become tasks."
            />
            <Capability
              icon={Users}
              title="Workload you can see"
              body="Who’s overloaded this week, before you assign one more thing."
            />
          </ul>
        </section>
      </main>

      <footer className="border-t border-[#E7E2D9] bg-[#F6F4EF]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="text-sm font-medium">Task Planner and Tracker</span>
          </div>
          <p className="text-xs text-[#8A8278]">
            Plan it. Track it. Keep the rooms separate.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Fact({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-[#FFFDF8] px-6 py-8 sm:px-8">
      <p className="text-[11px] tabular-nums text-[#A39A8E]">{kicker}</p>
      <h3 className="mt-6 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#5C6570]">{body}</p>
    </div>
  );
}

function RhythmRow({ n, q, a }: { n: string; q: string; a: string }) {
  return (
    <li className="grid gap-2 py-5 sm:grid-cols-[3rem_minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-baseline sm:gap-8">
      <span className="text-xs tabular-nums text-[#A39A8E]">{n}</span>
      <p className="font-medium">{q}</p>
      <p className="text-sm leading-6 text-[#5C6570]">{a}</p>
    </li>
  );
}

function Capability({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CheckSquare;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-[#E7E2D9] bg-white p-5">
      <Icon className="h-4 w-4 text-[#635BFF]" />
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-[#5C6570]">{body}</p>
    </li>
  );
}

function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-3 rounded-[22px] bg-[#E7E2D9]/70" />
      <div className="relative overflow-hidden rounded-[18px] border border-[#D9D3C8] bg-white shadow-[0_24px_60px_rgba(23,32,51,0.12)]">
        <div className="flex items-center gap-2 border-b border-[#EEEAE3] bg-[#FAF8F4] px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#E7E2D9]" />
          <span className="h-2 w-2 rounded-full bg-[#E7E2D9]" />
          <span className="h-2 w-2 rounded-full bg-[#E7E2D9]" />
          <span className="ml-2 text-[11px] text-[#8A8278]">Dashboard</span>
        </div>
        <div className="grid grid-cols-[44px_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3 bg-[#0B1220] py-4">
            <span className="h-5 w-5 rounded bg-[#635BFF]" />
            <span className="h-3 w-3 rounded-sm bg-white/20" />
            <span className="h-3 w-3 rounded-sm bg-white/20" />
            <span className="h-3 w-3 rounded-sm bg-white/20" />
          </div>
          <div className="space-y-4 bg-[#F8FAFC] p-4">
            <div>
              <p className="text-[11px] text-[#64748B]">Wednesday</p>
              <p className="text-sm font-semibold">Welcome back</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Open" value="12" />
              <MiniStat label="Overdue" value="2" warn />
              <MiniStat label="Meetings" value="3" />
            </div>
            <div className="rounded-lg border border-[#E5E7EB] bg-white">
              <div className="border-b border-[#E5E7EB] px-3 py-2 text-[11px] font-medium text-[#64748B]">
                My work
              </div>
              <PreviewRow title="Ship review notes" meta="Website · Today" />
              <PreviewRow title="Prep standup" meta="Ops · 10:00" />
              <PreviewRow title="Fix overdue copy" meta="Launch · High" last />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2">
      <p className="text-[10px] text-[#64748B]">{label}</p>
      <p
        className={`text-lg font-semibold ${warn ? "text-[#EF4444]" : "text-[#172033]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function PreviewRow({
  title,
  meta,
  last,
}: {
  title: string;
  meta: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 ${last ? "" : "border-b border-[#E5E7EB]"}`}
    >
      <span className="h-3.5 w-3.5 rounded border border-[#CBD5E1]" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{title}</p>
        <p className="text-[10px] text-[#64748B]">{meta}</p>
      </div>
    </div>
  );
}
