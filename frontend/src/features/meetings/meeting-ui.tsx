"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  ExternalLink,
  FileText,
  FolderKanban,
  ListChecks,
  ListTodo,
  MapPin,
  Paperclip,
  Plus,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { SegmentedControl, Surface } from "@/components/page-header";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge, StatusBadge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { downloadFile } from "@/features/collaboration/api";
import { useFiles, useTeams, useUploadFile } from "@/features/collaboration/hooks";
import { useProjects } from "@/features/projects/hooks";
import {
  useCalendar,
  useConvertActionItem,
  useCreateActionItem,
  useRsvpMeeting,
  useUpdateActionItem,
  useUpdateAgenda,
  useUpdateMeeting,
} from "@/features/meetings/hooks";
import {
  CALENDAR_EVENT_TYPES,
  PROVIDER_LABELS,
  RANGE_LABELS,
  type CalendarEvent,
  type CalendarEventType,
  type Meeting,
  type MeetingActionItem,
  type MeetingRange,
  type MeetingResponse,
} from "@/features/meetings/types";
import { PRIORITIES, type Priority } from "@/features/projects/types";
import { useWorkspaceMembers } from "@/features/workspaces/hooks";
import {
  cn,
  formatDate,
  formatTime,
  fromDateInputValue,
  nativeSelectClass,
  nativeTextareaClass,
  toDateInputValue,
} from "@/lib/utils";

export function joinMeetingUrl(url: string | null | undefined) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function formatMeetingTime(meeting: Meeting) {
  const start = new Date(meeting.startAt);
  const end = new Date(meeting.endAt);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${time.format(start)} – ${time.format(end)}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** "Google Meet" / "Office · Room A" — where the meeting happens. */
export function meetingPlaceLabel(meeting: Meeting) {
  if (meeting.mode === "ONLINE") {
    return meeting.meetingProvider
      ? PROVIDER_LABELS[meeting.meetingProvider]
      : "Online";
  }
  return (
    [meeting.location, meeting.room].filter(Boolean).join(" · ") || "In person"
  );
}

function meetingPeople(meeting: Meeting) {
  return meeting.participants.map((item) => ({
    id: item.userId ?? item.id,
    name: item.name ?? item.user?.name ?? "Guest",
  }));
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/* ------------------------------------------------------------------ */
/* List row                                                            */
/* ------------------------------------------------------------------ */

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const people = meetingPeople(meeting);
  const joinUrl = joinMeetingUrl(meeting.meetingUrl ?? meeting.meetingLink);
  const start = new Date(meeting.startAt);
  const inactive =
    meeting.status === "CANCELLED" || meeting.status === "COMPLETED";
  const canJoin = meeting.mode === "ONLINE" && joinUrl && !inactive;
  const ModeIcon = meeting.mode === "ONLINE" ? Video : MapPin;

  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60 sm:gap-4">
      <div
        className={cn(
          "flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border py-1.5",
          inactive ? "bg-muted" : "bg-card",
        )}
      >
        <span className="text-2xs font-medium uppercase tracking-[0.06em] text-subtle-foreground">
          {start.toLocaleString(undefined, { month: "short" })}
        </span>
        <span className="font-heading text-lg font-semibold leading-tight text-foreground tabular">
          {start.getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/app/meetings/${meeting.id}`}
            className={cn(
              "min-w-0 truncate rounded-sm text-base font-medium text-foreground after:absolute after:inset-0 after:content-['']",
              focusRing,
              meeting.status === "CANCELLED" &&
                "text-muted-foreground line-through",
            )}
          >
            {meeting.title}
          </Link>
          {meeting.status !== "SCHEDULED" ? (
            <StatusBadge value={meeting.status} className="shrink-0" />
          ) : null}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular">
            <Clock className="size-3.5 shrink-0" />
            {formatMeetingTime(meeting)}
            <span className="text-subtle-foreground">
              · {formatDuration(meeting.durationMinutes ?? 0)}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <ModeIcon className="size-3.5 shrink-0" />
            <span className="truncate">{meetingPlaceLabel(meeting)}</span>
          </span>
          {meeting.project ? (
            <span className="hidden min-w-0 items-center gap-1 md:inline-flex">
              <FolderKanban className="size-3.5 shrink-0" />
              <span className="truncate">{meeting.project.name}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-3">
        {people.length ? (
          <span
            className="hidden sm:block"
            title={people.map((person) => person.name).join(", ")}
          >
            <AvatarStack people={people} max={4} size="sm" />
          </span>
        ) : null}
        {canJoin ? (
          <Button asChild size="sm" variant="soft">
            <a href={joinUrl} target="_blank" rel="noreferrer">
              <Video />
              <span className="hidden sm:inline">Join</span>
              <span className="sr-only sm:hidden">Join {meeting.title}</span>
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MeetingRangeTabs({
  value,
  onChange,
}: {
  value: MeetingRange;
  onChange: (range: MeetingRange) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      label="Meeting range"
      options={(Object.keys(RANGE_LABELS) as MeetingRange[]).map((range) => ({
        value: range,
        label: RANGE_LABELS[range],
      }))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Detail panels                                                       */
/* ------------------------------------------------------------------ */

function PanelTitle({
  icon: Icon,
  children,
  count,
  action,
}: {
  icon: typeof Users;
  children: ReactNode;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-md font-semibold tracking-[-0.01em] text-foreground">
        <Icon className="size-4 text-muted-foreground" strokeWidth={2} />
        {children}
        {typeof count === "number" ? (
          <span className="text-sm font-normal text-subtle-foreground tabular">
            {count}
          </span>
        ) : null}
      </h2>
      {action}
    </div>
  );
}

const RESPONSE_META: Record<
  MeetingResponse,
  { label: string; variant: BadgeVariant }
> = {
  ACCEPTED: { label: "Going", variant: "success" },
  MAYBE: { label: "Maybe", variant: "warning" },
  DECLINED: { label: "Declined", variant: "danger" },
  PENDING: { label: "Awaiting", variant: "outline" },
};

const RSVP_OPTIONS: Array<{ value: MeetingResponse; label: string }> = [
  { value: "ACCEPTED", label: "Accept" },
  { value: "MAYBE", label: "Maybe" },
  { value: "DECLINED", label: "Decline" },
];

export function MeetingParticipants({
  meeting,
  userId,
  canWrite,
}: {
  meeting: Meeting;
  userId?: string;
  canWrite: boolean;
}) {
  const rsvp = useRsvpMeeting(meeting.id);
  const mine = meeting.participants.find(
    (item) => item.userId === userId || item.id === userId,
  );
  const accepted = meeting.participants.filter(
    (person) => person.response === "ACCEPTED",
  ).length;

  function respond(response: MeetingResponse) {
    void rsvp
      .mutateAsync(response)
      .then(() =>
        toast.success(
          response === "PENDING"
            ? "Response cleared"
            : `RSVP updated: ${RESPONSE_META[response].label}`,
        ),
      )
      .catch(() => undefined);
  }

  return (
    <Surface>
      <PanelTitle
        icon={Users}
        count={meeting.participants.length}
        action={
          meeting.participants.length ? (
            <span className="text-xs text-muted-foreground tabular">
              {accepted} going
            </span>
          ) : null
        }
      >
        Participants
      </PanelTitle>
      {mine && canWrite ? (
        <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Your RSVP</p>
            {mine.response !== "PENDING" ? (
              <button
                type="button"
                className={cn(
                  "rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground",
                  focusRing,
                )}
                disabled={rsvp.isPending}
                onClick={() => respond("PENDING")}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div
            role="radiogroup"
            aria-label="Your RSVP"
            className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-0.5"
          >
            {RSVP_OPTIONS.map((option) => {
              const active = mine.response === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={rsvp.isPending}
                  onClick={() => !active && respond(option.value)}
                  className={cn(
                    "h-7 rounded-md text-sm font-medium transition-colors duration-150 disabled:opacity-60",
                    focusRing,
                    active
                      ? option.value === "ACCEPTED"
                        ? "bg-success-soft text-success-soft-foreground"
                        : option.value === "DECLINED"
                          ? "bg-danger-soft text-danger-soft-foreground"
                          : "bg-warning-soft text-warning-soft-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {meeting.participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No participants invited.</p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {meeting.participants.map((person) => {
            const name = person.name ?? person.user?.name ?? "Guest";
            const meta = RESPONSE_META[person.response] ?? RESPONSE_META.PENDING;
            const isOrganizer =
              (person.userId ?? person.id) === meeting.organizerId;
            return (
              <li
                key={person.userId ?? person.id}
                className="flex items-center gap-2.5 rounded-md px-1 py-1.5"
              >
                <Avatar name={name} size="default" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {name}
                    {person.userId === userId || person.id === userId ? (
                      <span className="font-normal text-subtle-foreground"> (you)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isOrganizer
                      ? "Organizer"
                      : person.kind === "OPTIONAL"
                        ? "Optional"
                        : "Required"}
                  </p>
                </div>
                <Badge variant={meta.variant} dot>
                  {meta.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

export function MeetingAgenda({
  meeting,
  canWrite,
}: {
  meeting: Meeting;
  canWrite: boolean;
}) {
  // Re-mount the editor whenever the server agenda changes so local state
  // initialises from props (replaces a setState-in-effect sync).
  const agendaKey = `${meeting.id}:${meeting.agenda
    .map((item) => `${item.id}=${item.title}`)
    .join("|")}`;
  return <AgendaEditor key={agendaKey} meeting={meeting} canWrite={canWrite} />;
}

function AgendaEditor({
  meeting,
  canWrite,
}: {
  meeting: Meeting;
  canWrite: boolean;
}) {
  const updateAgenda = useUpdateAgenda(meeting.id);
  const [items, setItems] = useState(() =>
    meeting.agenda.map((item) => item.title),
  );

  async function save(next: string[]) {
    setItems(next);
    const cleaned = next.map((item) => item.trim()).filter(Boolean);
    const current = meeting.agenda.map((item) => item.title);
    try {
      await updateAgenda.mutateAsync(cleaned);
      if (cleaned.join("\u0000") !== current.join("\u0000")) {
        toast.success("Agenda updated");
      }
    } catch {
      // Keep local edits; mutation error is not a page crash.
    }
  }

  return (
    <Surface>
      <PanelTitle
        icon={ListChecks}
        count={items.length || undefined}
        action={
          updateAgenda.isPending ? (
            <span className="text-xs text-muted-foreground">Saving…</span>
          ) : null
        }
      >
        Agenda
      </PanelTitle>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agenda items yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${meeting.id}-agenda-${index}`}
              className="group/agenda flex items-center gap-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground tabular">
                {index + 1}
              </span>
              {canWrite ? (
                <>
                  <Input
                    value={item}
                    aria-label={`Agenda item ${index + 1}`}
                    placeholder="Agenda item"
                    className="h-8 flex-1"
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = event.target.value;
                      setItems(next);
                    }}
                    onBlur={() => void save(items)}
                  />
                  <div className="flex shrink-0 items-center">
                    <Tooltip content="Move up">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move agenda item ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...items];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          void save(next);
                        }}
                      >
                        <ArrowUp />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Move down">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move agenda item ${index + 1} down`}
                        disabled={index === items.length - 1}
                        onClick={() => {
                          const next = [...items];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          void save(next);
                        }}
                      >
                        <ArrowDown />
                      </Button>
                    </Tooltip>
                  </div>
                </>
              ) : (
                <p className="py-1 text-base text-foreground">{item}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {canWrite ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 text-muted-foreground"
          onClick={() => setItems([...items, ""])}
        >
          <Plus />
          Add item
        </Button>
      ) : null}
    </Surface>
  );
}

export function MeetingNotes({
  meeting,
  canWrite,
}: {
  meeting: Meeting;
  canWrite: boolean;
}) {
  const updateMeeting = useUpdateMeeting(meeting.id);
  const [discussion, setDiscussion] = useState(
    meeting.discussion ?? meeting.notes ?? "",
  );
  const [decisions, setDecisions] = useState(meeting.decisions ?? "");
  const skipAutosave = useRef(true);
  const saveNotes = updateMeeting.mutate;

  useEffect(() => {
    if (!canWrite) return;
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const currentDiscussion = meeting.discussion ?? meeting.notes ?? "";
      const currentDecisions = meeting.decisions ?? "";
      if (discussion === currentDiscussion && decisions === currentDecisions) {
        return;
      }
      saveNotes({
        discussion,
        decisions,
        notes: discussion,
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    canWrite,
    decisions,
    discussion,
    meeting.decisions,
    meeting.discussion,
    meeting.notes,
    saveNotes,
  ]);

  return (
    <Surface>
      <PanelTitle
        icon={FileText}
        action={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              updateMeeting.isPending
                ? "text-muted-foreground"
                : "text-subtle-foreground",
            )}
          >
            {updateMeeting.isPending ? (
              "Saving…"
            ) : canWrite ? (
              <>
                <CircleCheck className="size-3.5" />
                Autosaves
              </>
            ) : (
              "Read only"
            )}
          </span>
        }
      >
        Notes
      </PanelTitle>
      {updateMeeting.error ? (
        <ErrorState
          className="mb-4"
          title="Couldn't save notes"
          description={updateMeeting.error.message}
        />
      ) : null}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`meeting-discussion-${meeting.id}`}>Discussion</Label>
          <textarea
            id={`meeting-discussion-${meeting.id}`}
            className={cn(nativeTextareaClass, "min-h-28")}
            value={discussion}
            onChange={(event) => setDiscussion(event.target.value)}
            disabled={!canWrite}
            placeholder="What was discussed"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`meeting-decisions-${meeting.id}`}>Decisions</Label>
          <textarea
            id={`meeting-decisions-${meeting.id}`}
            className={nativeTextareaClass}
            value={decisions}
            onChange={(event) => setDecisions(event.target.value)}
            disabled={!canWrite}
            placeholder="What was decided"
          />
        </div>
      </div>
    </Surface>
  );
}

export function MeetingActionItems({
  meeting,
  canWrite,
}: {
  meeting: Meeting;
  canWrite: boolean;
}) {
  const members = useWorkspaceMembers(meeting.workspaceId);
  const createItem = useCreateActionItem(meeting.id);
  const updateItem = useUpdateActionItem(meeting.id);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [converting, setConverting] = useState<MeetingActionItem | null>(null);
  const items = meeting.actionItems ?? [];
  const doneCount = items.filter((item) => item.done).length;
  const [nowMs] = useState(() => Date.now());

  async function addItem() {
    if (!title.trim()) return;
    await createItem.mutateAsync({
      title: title.trim(),
      assigneeId: assigneeId || undefined,
      dueDate: fromDateInputValue(dueDate),
    });
    toast.success("Action item added");
    setTitle("");
    setAssigneeId("");
    setDueDate("");
  }

  return (
    <Surface>
      <PanelTitle
        icon={ListTodo}
        action={
          items.length ? (
            <span className="text-xs text-muted-foreground tabular">
              {doneCount}/{items.length} done
            </span>
          ) : null
        }
      >
        Action items
      </PanelTitle>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No action items yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => {
            const overdue =
              !item.done &&
              item.dueDate &&
              new Date(item.dueDate).getTime() < nowMs;
            return (
              <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                <input
                  id={`action-item-${item.id}`}
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-primary disabled:cursor-default"
                  checked={item.done}
                  disabled={!canWrite}
                  onChange={() =>
                    void updateItem
                      .mutateAsync({
                        itemId: item.id,
                        input: { done: !item.done },
                      })
                      .then(() =>
                        toast.success(
                          item.done ? "Action item reopened" : "Action item completed",
                        ),
                      )
                      .catch(() => undefined)
                  }
                />
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`action-item-${item.id}`}
                    className={cn(
                      "block cursor-pointer text-base font-medium text-foreground",
                      item.done && "text-muted-foreground line-through",
                    )}
                  >
                    {item.title}
                  </label>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {item.assignee ? (
                        <Avatar name={item.assignee.name} size="xs" />
                      ) : null}
                      {item.assignee?.name ?? "Unassigned"}
                    </span>
                    {item.dueDate ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          overdue && "text-danger-soft-foreground",
                        )}
                      >
                        <CalendarDays className="size-3" />
                        {formatDate(item.dueDate)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {item.task ? (
                  <Link
                    href={`/app/tasks/${item.task.id}`}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary-soft-foreground transition-colors hover:bg-primary-soft/70",
                      focusRing,
                    )}
                    title="Linked task · Created from Meeting"
                  >
                    <ExternalLink className="size-3" />
                    Task
                  </Link>
                ) : canWrite ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="shrink-0"
                    onClick={() => setConverting(item)}
                  >
                    Create Task
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canWrite ? (
        <form
          className="mt-4 space-y-2 rounded-lg border border-dashed border-border-strong p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void addItem().catch(() => undefined);
          }}
        >
          <Input
            value={title}
            aria-label="New action item"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add an action item…"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className={nativeSelectClass}
              aria-label="Assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {(members.data ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              aria-label="Due date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim()}
              loading={createItem.isPending}
            >
              <Plus />
              Add action item
            </Button>
          </div>
        </form>
      ) : null}
      {converting ? (
        <ConvertActionItemDialog
          meeting={meeting}
          item={converting}
          onClose={() => setConverting(null)}
        />
      ) : null}
    </Surface>
  );
}

function ConvertActionItemDialog({
  meeting,
  item,
  onClose,
}: {
  meeting: Meeting;
  item: MeetingActionItem;
  onClose: () => void;
}) {
  const projects = useProjects(meeting.workspaceId);
  const members = useWorkspaceMembers(meeting.workspaceId);
  const convert = useConvertActionItem(meeting.id);
  const [title, setTitle] = useState(item.title);
  const [assigneeId, setAssigneeId] = useState(item.assigneeId ?? "");
  const [projectId, setProjectId] = useState(meeting.projectId ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(item.dueDate));
  const [priority, setPriority] = useState<Priority>("MEDIUM");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Turn this action item into a tracked task linked to the meeting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="convert-title">Title</Label>
            <Input
              id="convert-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="convert-assignee">Assignee</Label>
              <select
                id="convert-assignee"
                className={nativeSelectClass}
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {(members.data ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-project">Project</Label>
              <select
                id="convert-project"
                className={nativeSelectClass}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">No project</option>
                {(projects.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-due">Due date</Label>
              <Input
                id="convert-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-priority">Priority</Label>
              <select
                id="convert-priority"
                className={nativeSelectClass}
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {PRIORITIES.map((itemPriority) => (
                  <option key={itemPriority} value={itemPriority}>
                    {itemPriority.charAt(0) + itemPriority.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {convert.error ? (
            <ErrorState
              title="Couldn't create task"
              description={convert.error.message}
            />
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!title.trim()}
              loading={convert.isPending}
              onClick={async () => {
                await convert.mutateAsync({
                  itemId: item.id,
                  input: {
                    title: title.trim(),
                    assigneeId: assigneeId || undefined,
                    projectId: projectId || undefined,
                    dueDate: fromDateInputValue(dueDate),
                    priority,
                  },
                });
                toast.success("Task created from action item");
                onClose();
              }}
            >
              Create task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingLinkedTasks({ meeting }: { meeting: Meeting }) {
  const items = meeting.linkedTasks ?? [];
  return (
    <Surface>
      <PanelTitle icon={ListChecks} count={items.length || undefined}>
        Linked tasks
      </PanelTitle>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tasks created from this meeting will appear here.
        </p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {items.map((task) => (
            <li key={task.id}>
              <Link
                href={`/app/tasks/${task.id}`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted",
                  focusRing,
                )}
                title="Created from Meeting"
              >
                <span className="min-w-0 truncate font-medium text-foreground">
                  {task.title}
                </span>
                <StatusBadge value={task.status} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

export function MeetingFiles({
  meeting,
  canWrite,
}: {
  meeting: Meeting;
  canWrite: boolean;
}) {
  const files = useFiles(meeting.workspaceId, { meetingId: meeting.id });
  const upload = useUploadFile();
  return (
    <Surface>
      <PanelTitle
        icon={Paperclip}
        count={(files.data ?? []).length || undefined}
        action={
          canWrite ? (
            <label className="inline-flex">
              <input
                type="file"
                className="peer sr-only"
                disabled={upload.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void upload
                      .mutateAsync({
                        file,
                        attach: { meetingId: meeting.id },
                      })
                      .then(() => toast.success("File uploaded"))
                      .catch(() => undefined);
                  }
                  event.target.value = "";
                }}
              />
              <span className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                <Upload className="size-3.5" />
                {upload.isPending ? "Uploading…" : "Upload"}
              </span>
            </label>
          ) : null
        }
      >
        Files
      </PanelTitle>
      {files.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : (files.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached.</p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {(files.data ?? []).map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                  focusRing,
                )}
                onClick={() => void downloadFile(file.id, file.originalName)}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {file.originalName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular">
                  {Math.round(file.sizeBytes / 1024)} KB
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

export function MeetingMeta({ meeting }: { meeting: Meeting }) {
  const mapHref = meeting.mapUrl
    ? (joinMeetingUrl(meeting.mapUrl) ?? meeting.mapUrl)
    : null;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs lg:grid-cols-4">
      <MetaChip
        icon={<CalendarDays className="size-3.5" />}
        label="Date"
        value={new Date(meeting.startAt).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      />
      <MetaChip
        icon={<Clock className="size-3.5" />}
        label="Time"
        value={formatMeetingTime(meeting)}
        hint={formatDuration(meeting.durationMinutes ?? 0)}
      />
      <MetaChip
        icon={
          meeting.mode === "ONLINE" ? (
            <Video className="size-3.5" />
          ) : (
            <MapPin className="size-3.5" />
          )
        }
        label={meeting.mode === "ONLINE" ? "Online" : "In person"}
        value={meetingPlaceLabel(meeting)}
        hint={
          meeting.mode !== "ONLINE" && mapHref ? (
            <a
              href={mapHref}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-1 rounded-sm text-primary hover:underline",
                focusRing,
              )}
            >
              Open map
              <ExternalLink className="size-3" />
            </a>
          ) : meeting.mode !== "ONLINE" && meeting.address ? (
            meeting.address
          ) : undefined
        }
      />
      <MetaChip
        icon={<FolderKanban className="size-3.5" />}
        label="Project"
        value={meeting.project?.name ?? "No project"}
        href={meeting.project ? `/app/projects/${meeting.project.id}` : undefined}
      />
    </div>
  );
}

function MetaChip({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  hint?: ReactNode;
  href?: string;
}) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      {href ? (
        <Link
          href={href}
          className={cn(
            "mt-1 block truncate rounded-sm text-base font-medium text-foreground hover:text-primary",
            focusRing,
          )}
        >
          {value}
        </Link>
      ) : (
        <p className="mt-1 truncate text-base font-medium text-foreground tabular">
          {value}
        </p>
      )}
      {hint ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

const EVENT_STYLES: Record<CalendarEventType, string> = {
  meeting: "bg-primary-soft text-primary-soft-foreground",
  task: "bg-info-soft text-info-soft-foreground",
  deadline: "bg-warning-soft text-warning-soft-foreground",
  milestone: "bg-success-soft text-success-soft-foreground",
};

const EVENT_DOTS: Record<CalendarEventType, string> = {
  meeting: "bg-primary",
  task: "bg-info",
  deadline: "bg-warning",
  milestone: "bg-success",
};

const EVENT_LABELS: Record<CalendarEventType, string> = {
  meeting: "Meetings",
  task: "Tasks",
  deadline: "Deadlines",
  milestone: "Milestones",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

function eventIsInactive(event: CalendarEvent) {
  return event.status === "COMPLETED" || event.status === "CANCELLED";
}

function eventTimeLabel(event: CalendarEvent) {
  const start = new Date(event.startAt);
  if (event.type === "meeting") return formatTime(start);
  // Tasks/deadlines stored at midnight are all-day.
  if (start.getHours() === 0 && start.getMinutes() === 0) return "All day";
  return formatTime(start);
}

type CalendarView = "month" | "agenda";

export function TeamCalendar({
  workspaceId,
  projectId: lockedProjectId,
}: {
  workspaceId: string | null;
  projectId?: string;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [view, setView] = useState<CalendarView>("month");
  const [types, setTypes] = useState<CalendarEventType[]>([
    ...CALENDAR_EVENT_TYPES,
  ]);
  const [teamId, setTeamId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const projectId = lockedProjectId ?? selectedProjectId;
  const [userId, setUserId] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const teams = useTeams(workspaceId);
  const projects = useProjects(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const from = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), 1));
  const to = new Date(
    Date.UTC(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999),
  );
  const calendar = useCalendar(workspaceId, {
    from: from.toISOString(),
    to: to.toISOString(),
    teamId: teamId || undefined,
    projectId: projectId || undefined,
    userId: userId || undefined,
    types,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of calendar.data?.events ?? []) {
      const key = localDayKey(new Date(event.startAt));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
    }
    return map;
  }, [calendar.data]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((startWeekday + daysInMonth) / 7);
  const cells = Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = new Date(year, month, index - startWeekday + 1);
    return { date, key: localDayKey(date), inMonth: date.getMonth() === month };
  });
  const todayKey = localDayKey(now);
  const activeDay = selectedDay ?? todayKey;
  const selectedEvents = byDay.get(activeDay) ?? [];
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const monthDays = [...byDay.keys()]
    .filter((key) => key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .sort();
  const eventCount = monthDays.reduce(
    (total, key) => total + (byDay.get(key)?.length ?? 0),
    0,
  );

  function toggleType(type: CalendarEventType) {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  function goToday() {
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(todayKey);
  }

  const agendaList = (
    <CalendarAgenda
      days={monthDays}
      byDay={byDay}
      todayKey={todayKey}
      loading={calendar.isLoading}
    />
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Tooltip content="Previous month">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Button>
            </Tooltip>
            <Tooltip content="Next month">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight />
              </Button>
            </Tooltip>
          </div>
          <h2 className="min-w-[9.5rem] font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
            {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={goToday}
            disabled={isCurrentMonth && activeDay === todayKey}
          >
            Today
          </Button>
          <span className="hidden text-sm text-muted-foreground tabular sm:inline">
            {calendar.isLoading ? "" : `${eventCount} ${eventCount === 1 ? "event" : "events"}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Event types"
          >
            {CALENDAR_EVENT_TYPES.map((type) => {
              const active = types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors duration-150",
                    focusRing,
                    active
                      ? "border-transparent " + EVENT_STYLES[type]
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => toggleType(type)}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      active ? EVENT_DOTS[type] : "bg-subtle-foreground",
                    )}
                  />
                  {EVENT_LABELS[type]}
                </button>
              );
            })}
          </div>
          <SegmentedControl
            className="hidden sm:inline-flex"
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Month", icon: <CalendarDays /> },
              { value: "agenda", label: "Agenda", icon: <CalendarRange /> },
            ]}
          />
        </div>
      </div>

      {/* Filters */}
      <div
        className={cn(
          "grid gap-2",
          lockedProjectId ? "sm:grid-cols-2" : "sm:grid-cols-3",
        )}
      >
        <select
          aria-label="Filter by team"
          className={cn(nativeSelectClass, "h-8 text-sm")}
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
        >
          <option value="">All teams</option>
          {(teams.data ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        {lockedProjectId ? null : (
          <select
            aria-label="Filter by project"
            className={cn(nativeSelectClass, "h-8 text-sm")}
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">All projects</option>
            {(projects.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Filter by person"
          className={cn(nativeSelectClass, "h-8 text-sm")}
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value="">All people</option>
          {(members.data ?? []).map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user.name}
            </option>
          ))}
        </select>
      </div>

      {calendar.isError ? (
        <ErrorState
          title="Couldn't load the calendar"
          description={calendar.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void calendar.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile always gets the agenda list */}
          <div className="sm:hidden">{agendaList}</div>
          <div className="hidden sm:block">
            {view === "agenda" ? (
              agendaList
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  <div className="grid grid-cols-7 border-b border-border bg-muted/50">
                    {WEEKDAYS.map((day) => (
                      <div
                        key={day}
                        className="px-2 py-2 text-2xs font-medium uppercase tracking-[0.08em] text-subtle-foreground"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {cells.map((cell, index) => {
                      const dayEvents = cell.inMonth
                        ? (byDay.get(cell.key) ?? [])
                        : [];
                      const isToday = cell.key === todayKey;
                      const isSelected = cell.inMonth && activeDay === cell.key;
                      const lastCol = index % 7 === 6;
                      const lastRow = index >= cells.length - 7;
                      return (
                        <div
                          key={cell.key}
                          onClick={() => cell.inMonth && setSelectedDay(cell.key)}
                          className={cn(
                            "group/day relative min-h-[104px] p-1.5 transition-colors duration-150",
                            !lastCol && "border-r border-border",
                            !lastRow && "border-b border-border",
                            cell.inMonth
                              ? "cursor-pointer hover:bg-muted/50"
                              : "bg-muted/40",
                            isSelected && "bg-primary-soft/40 hover:bg-primary-soft/50",
                          )}
                        >
                          {calendar.isLoading ? (
                            <>
                              <DayNumber cell={cell} isToday={isToday} />
                              {cell.inMonth && index % 3 === 0 ? (
                                <Skeleton className="mt-1 h-4 w-4/5" />
                              ) : null}
                            </>
                          ) : (
                            <>
                              {cell.inMonth ? (
                                <button
                                  type="button"
                                  aria-label={`${cell.date.toLocaleDateString(undefined, {
                                    weekday: "long",
                                    month: "long",
                                    day: "numeric",
                                  })}, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`}
                                  aria-pressed={isSelected}
                                  onClick={(click) => {
                                    click.stopPropagation();
                                    setSelectedDay(cell.key);
                                  }}
                                  className={cn("rounded-full", focusRing)}
                                >
                                  <DayNumber cell={cell} isToday={isToday} />
                                </button>
                              ) : (
                                <DayNumber cell={cell} isToday={isToday} />
                              )}
                              <div className="mt-1 space-y-0.5">
                                {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                                  <Link
                                    key={event.id}
                                    href={event.href}
                                    title={`${event.title} · ${eventTimeLabel(event)}`}
                                    className={cn(
                                      "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
                                      focusRing,
                                      EVENT_STYLES[event.type],
                                      eventIsInactive(event) && "line-through opacity-60",
                                    )}
                                    onClick={(click) => click.stopPropagation()}
                                  >
                                    <span className="truncate">{event.title}</span>
                                  </Link>
                                ))}
                                {dayEvents.length > MAX_CHIPS ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      "rounded px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground",
                                      focusRing,
                                    )}
                                    onClick={(click) => {
                                      click.stopPropagation();
                                      setSelectedDay(cell.key);
                                    }}
                                  >
                                    +{dayEvents.length - MAX_CHIPS} more
                                  </button>
                                ) : null}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Surface className="self-start p-4 sm:p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                    {activeDay === todayKey ? "Today" : "Selected day"}
                  </p>
                  <h3 className="mt-0.5 font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
                    {new Date(`${activeDay}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </h3>
                  <div className="mt-3">
                    {calendar.isLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : selectedEvents.length === 0 ? (
                      <EmptyState
                        compact
                        icon={CalendarDays}
                        title="Nothing scheduled"
                        description="Pick another day or adjust the filters."
                        className="py-6"
                      />
                    ) : (
                      <ul className="-mx-1 space-y-0.5">
                        {selectedEvents.map((event) => (
                          <li key={event.id}>
                            <CalendarEventRow event={event} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Surface>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DayNumber({
  cell,
  isToday,
}: {
  cell: { date: Date; inMonth: boolean };
  isToday: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular",
        isToday
          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-card"
          : cell.inMonth
            ? "text-foreground group-hover/day:bg-muted"
            : "text-subtle-foreground",
      )}
    >
      {cell.date.getDate()}
    </span>
  );
}

function CalendarEventRow({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={event.href}
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-muted",
        focusRing,
      )}
    >
      <span
        aria-hidden
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", EVENT_DOTS[event.type])}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-base font-medium text-foreground",
            eventIsInactive(event) && "text-muted-foreground line-through",
          )}
        >
          {event.title}
        </span>
        <span className="block text-xs capitalize text-muted-foreground">
          {event.type} · {eventTimeLabel(event)}
        </span>
      </span>
      {event.status && event.type !== "milestone" ? (
        <StatusBadge value={event.status} className="shrink-0" />
      ) : null}
    </Link>
  );
}

function CalendarAgenda({
  days,
  byDay,
  todayKey,
  loading,
}: {
  days: string[];
  byDay: Map<string, CalendarEvent[]>;
  todayKey: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ))}
      </div>
    );
  }
  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <EmptyState
          icon={CalendarDays}
          title="Nothing this month"
          description="No events match these filters. Try another month or include more event types."
        />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {days.map((key) => {
        const date = new Date(`${key}T00:00:00`);
        const isToday = key === todayKey;
        return (
          <section
            key={key}
            className="flex gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:gap-4 sm:px-4"
          >
            <div className="w-11 shrink-0 pt-1 text-center">
              <p
                className={cn(
                  "text-2xs font-medium uppercase tracking-[0.06em]",
                  isToday ? "text-primary" : "text-subtle-foreground",
                )}
              >
                {date.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p
                className={cn(
                  "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full font-heading text-lg font-semibold tabular",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {date.getDate()}
              </p>
            </div>
            <ul className="min-w-0 flex-1 space-y-0.5">
              {(byDay.get(key) ?? []).map((event) => (
                <li key={event.id}>
                  <CalendarEventRow event={event} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
