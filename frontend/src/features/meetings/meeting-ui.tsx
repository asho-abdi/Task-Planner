"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Video } from "lucide-react";
import { MemberAvatarGroup } from "@/components/member-avatar-group";
import { SegmentedControl, Surface } from "@/components/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  formatDateTime,
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

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const people = meeting.participants.map((item) => ({
    id: item.userId ?? item.id,
    name: item.name ?? item.user?.name ?? "Guest",
  }));
  const joinUrl = joinMeetingUrl(meeting.meetingUrl ?? meeting.meetingLink);
  return (
    <Link
      href={`/app/meetings/${meeting.id}`}
      className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-[#F8FAFC]"
    >
      <div className="w-[88px] shrink-0 pt-0.5">
        <p className="text-[12px] font-medium text-[#172033]">
          {formatDate(meeting.startAt)}
        </p>
        <p className="mt-0.5 text-[12px] text-[#64748B]">
          {formatMeetingTime(meeting)}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-[13px] font-medium text-[#172033]">
            {meeting.title}
          </h2>
          <StatusBadge value={meeting.status} />
          <Badge variant={meeting.mode === "ONLINE" ? "info" : "outline"}>
            {meeting.mode === "ONLINE" ? "Online" : "In person"}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[#64748B]">
          {formatDuration(meeting.durationMinutes ?? 0)} ·{" "}
          {meeting.project?.name ?? "No project"} · {meeting.organizer.name}
          {meeting.mode === "ONLINE" && joinUrl
            ? " · Join link ready"
            : meeting.location
              ? ` · ${meeting.location}${meeting.room ? ` · ${meeting.room}` : ""}`
              : ""}
        </p>
      </div>
      <MemberAvatarGroup people={people} />
    </Link>
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
      options={(Object.keys(RANGE_LABELS) as MeetingRange[]).map((range) => ({
        value: range,
        label: RANGE_LABELS[range],
      }))}
    />
  );
}

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
  return (
    <Surface>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Participants</h2>
        {mine && canWrite ? (
          <select
            className="h-8 rounded-md border border-border bg-card px-2 text-xs"
            value={mine.response}
            disabled={rsvp.isPending}
            onChange={(event) =>
              void rsvp
                .mutateAsync(event.target.value as MeetingResponse)
                .catch(() => undefined)
            }
          >
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DECLINED">Declined</option>
            <option value="MAYBE">Maybe</option>
          </select>
        ) : null}
      </div>
      <div className="space-y-2">
        {meeting.participants.map((person) => (
          <div
            key={person.userId ?? person.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{person.name ?? person.user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {person.kind === "OPTIONAL" ? "Optional" : "Required"}
              </p>
            </div>
            <StatusBadge value={person.response} />
          </div>
        ))}
      </div>
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
  const updateAgenda = useUpdateAgenda(meeting.id);
  const [items, setItems] = useState(meeting.agenda.map((item) => item.title));

  useEffect(() => {
    setItems(meeting.agenda.map((item) => item.title));
  }, [meeting.id, meeting.agenda]);

  async function save(next: string[]) {
    setItems(next);
    try {
      await updateAgenda.mutateAsync(
        next.map((item) => item.trim()).filter(Boolean),
      );
    } catch {
      // Keep local edits; mutation error is not a page crash.
    }
  }

  return (
    <Surface>
      <h2 className="mb-3 text-base font-semibold">Agenda</h2>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${meeting.id}-agenda-${index}`} className="flex gap-2">
            <span className="mt-2 w-5 text-xs text-muted-foreground">
              {index + 1}.
            </span>
            {canWrite ? (
              <>
                <Input
                  value={item}
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = event.target.value;
                    setItems(next);
                  }}
                  onBlur={() => void save(items)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...items];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    void save(next);
                  }}
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === items.length - 1}
                  onClick={() => {
                    const next = [...items];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    void save(next);
                  }}
                >
                  Down
                </Button>
              </>
            ) : (
              <p className="py-2 text-sm">{item}</p>
            )}
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agenda items yet.</p>
        ) : null}
        {canWrite ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems([...items, ""])}
          >
            Add item
          </Button>
        ) : null}
      </div>
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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Meeting notes</h2>
        {updateMeeting.isPending ? (
          <span className="text-xs text-muted-foreground">Saving…</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {canWrite ? "Autosaves" : "Read only"}
          </span>
        )}
      </div>
      {updateMeeting.error ? (
        <p className="mb-3 text-sm text-destructive">
          {updateMeeting.error.message}
        </p>
      ) : null}
      <label className="mb-2 block text-sm font-medium">Discussion</label>
      <textarea
        className={nativeTextareaClass}
        value={discussion}
        onChange={(event) => setDiscussion(event.target.value)}
        disabled={!canWrite}
        placeholder="What was discussed"
      />
      <label className="mb-2 mt-4 block text-sm font-medium">Decisions</label>
      <textarea
        className={nativeTextareaClass}
        value={decisions}
        onChange={(event) => setDecisions(event.target.value)}
        disabled={!canWrite}
        placeholder="What was decided"
      />
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

  async function addItem() {
    if (!title.trim()) return;
    await createItem.mutateAsync({
      title: title.trim(),
      assigneeId: assigneeId || undefined,
      dueDate: fromDateInputValue(dueDate),
    });
    setTitle("");
    setAssigneeId("");
    setDueDate("");
  }

  return (
    <Surface>
      <h2 className="mb-3 text-base font-semibold">Action items</h2>
      <div className="space-y-3">
        {(meeting.actionItems ?? []).map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border px-3 py-3"
          >
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={item.done}
                disabled={!canWrite}
                onChange={() =>
                  void updateItem.mutateAsync({
                    itemId: item.id,
                    input: { done: !item.done },
                  })
                }
              />
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", item.done && "line-through")}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Assigned: {item.assignee?.name ?? "Unassigned"}
                  {item.dueDate ? ` · Due: ${formatDate(item.dueDate)}` : ""}
                </p>
                {item.task ? (
                  <Link
                    href={`/app/tasks/${item.task.id}`}
                    className="mt-1 inline-block text-xs text-primary"
                  >
                    Linked task · Created from Meeting
                  </Link>
                ) : canWrite ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setConverting(item)}
                  >
                    Create Task
                  </Button>
                ) : null}
              </div>
            </label>
          </div>
        ))}
        {(meeting.actionItems ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No action items yet.</p>
        ) : null}
      </div>
      {canWrite ? (
        <div className="mt-4 space-y-2 rounded-xl bg-secondary/50 p-3">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Finish API"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
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
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!title.trim() || createItem.isPending}
            onClick={() => void addItem()}
          >
            Add action item
          </Button>
        </div>
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
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <select
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
          <select
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
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          <select
            className={nativeSelectClass}
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {PRIORITIES.map((itemPriority) => (
              <option key={itemPriority} value={itemPriority}>
                {itemPriority}
              </option>
            ))}
          </select>
          {convert.error ? (
            <p className="text-sm text-destructive">{convert.error.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!title.trim() || convert.isPending}
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
                onClose();
              }}
            >
              Create Task
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
      <h2 className="mb-3 text-base font-semibold">Linked tasks</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tasks created from this meeting will appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((task) => (
            <Link
              key={task.id}
              href={`/app/tasks/${task.id}`}
              className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm"
            >
              <span className="truncate">{task.title}</span>
              <span className="text-xs text-muted-foreground">
                Created from Meeting
              </span>
            </Link>
          ))}
        </div>
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Files</h2>
        {canWrite ? (
          <label className="inline-flex">
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void upload.mutateAsync({
                    file,
                    attach: { meetingId: meeting.id },
                  });
                }
                event.target.value = "";
              }}
            />
            <Button asChild size="sm" variant="outline">
              <span>{upload.isPending ? "Uploading…" : "Upload"}</span>
            </Button>
          </label>
        ) : null}
      </div>
      {files.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (files.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached.</p>
      ) : (
        <div className="space-y-2">
          {(files.data ?? []).map((file) => (
            <button
              key={file.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-left text-sm"
              onClick={() => void downloadFile(file.id, file.originalName)}
            >
              <span className="truncate">{file.originalName}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(file.sizeBytes / 1024)} KB
              </span>
            </button>
          ))}
        </div>
      )}
    </Surface>
  );
}

export function MeetingMeta({ meeting }: { meeting: Meeting }) {
  const joinUrl = joinMeetingUrl(meeting.meetingUrl ?? meeting.meetingLink);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetaChip
        icon={<CalendarDays className="h-4 w-4" />}
        label="Date"
        value={formatDate(meeting.startAt)}
      />
      <MetaChip
        icon={<Clock className="h-4 w-4" />}
        label="Time"
        value={`${formatMeetingTime(meeting)} · ${formatDuration(meeting.durationMinutes ?? 0)}`}
      />
      <MetaChip
        icon={
          meeting.mode === "ONLINE" ? (
            <Video className="h-4 w-4" />
          ) : (
            <MapPin className="h-4 w-4" />
          )
        }
        label="Type"
        value={
          meeting.mode === "ONLINE"
            ? meeting.meetingProvider
              ? PROVIDER_LABELS[meeting.meetingProvider]
              : "Online"
            : [meeting.location, meeting.room].filter(Boolean).join(" · ") ||
              "Offline"
        }
      />
      <MetaChip
        label="Project"
        value={meeting.project?.name ?? "No project"}
      />
      {joinUrl && meeting.mode === "ONLINE" ? (
        <a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          className="sm:col-span-2"
        >
          <Button className="w-full">Join Meeting</Button>
        </a>
      ) : meeting.mapUrl ? (
        <a
          href={joinMeetingUrl(meeting.mapUrl) ?? meeting.mapUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary sm:col-span-2"
        >
          Open map
        </a>
      ) : null}
    </div>
  );
}

function MetaChip({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

const EVENT_STYLES: Record<CalendarEventType, string> = {
  meeting: "bg-indigo-100 text-indigo-800",
  task: "bg-sky-100 text-sky-800",
  deadline: "bg-amber-100 text-amber-900",
  milestone: "bg-emerald-100 text-emerald-800",
};

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

  const events = calendar.data?.events ?? [];
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = localDayKey(new Date(event.startAt));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const todayKey = localDayKey(now);
  const activeDay = selectedDay ?? todayKey;
  const selectedEvents = byDay.get(activeDay) ?? [];

  function toggleType(type: CalendarEventType) {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[148px] text-center text-[13px] font-semibold text-[#172033]">
            {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {CALENDAR_EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium capitalize",
                types.includes(type)
                  ? EVENT_STYLES[type]
                  : "bg-[#F8FAFC] text-[#64748B]",
              )}
              onClick={() => toggleType(type)}
            >
              {type === "meeting" ? "Meetings" : `${type}s`}
            </button>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "grid gap-2",
          lockedProjectId ? "sm:grid-cols-2" : "sm:grid-cols-3",
        )}
      >
        <select
          className={cn(nativeSelectClass, "h-8 text-[13px]")}
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
            className={cn(nativeSelectClass, "h-8 text-[13px]")}
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
          className={cn(nativeSelectClass, "h-8 text-[13px]")}
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
      {calendar.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : calendar.isError ? (
        <p className="text-sm text-destructive">{calendar.error.message}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <Surface className="overflow-x-auto p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#94A3B8]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
              {cells.map((day, index) => {
                const key = day
                  ? localDayKey(new Date(year, month, day))
                  : "";
                const dayEvents = day ? (byDay.get(key) ?? []) : [];
                const isToday =
                  day === now.getDate() &&
                  month === now.getMonth() &&
                  year === now.getFullYear();
                return (
                  <button
                    key={`${day ?? "empty"}-${index}`}
                    type="button"
                    disabled={!day}
                    onClick={() => day && setSelectedDay(key)}
                    className={cn(
                      "min-h-[84px] rounded-md p-1.5 text-left",
                      day ? "hover:bg-[#F8FAFC]" : "",
                      activeDay === key && day && "bg-[#F8FAFC]",
                    )}
                  >
                    {day ? (
                      <>
                        <p
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium",
                            isToday
                              ? "bg-primary text-white"
                              : "text-[#172033]",
                          )}
                        >
                          {day}
                        </p>
                        <div className="mt-1 space-y-0.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <Link
                              key={event.id}
                              href={event.href}
                              className={cn(
                                "block truncate rounded px-1 py-0.5 text-[11px]",
                                EVENT_STYLES[event.type],
                              )}
                              onClick={(click) => click.stopPropagation()}
                            >
                              {event.title}
                            </Link>
                          ))}
                          {dayEvents.length > 3 ? (
                            <p className="text-[11px] text-[#64748B]">
                              +{dayEvents.length - 3}
                            </p>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Surface>
          <Surface className="p-4 sm:p-4">
            <h2 className="text-[13px] font-semibold text-[#172033]">
              {formatDate(`${activeDay}T00:00:00`)}
            </h2>
            <div className="mt-3 space-y-1">
              {selectedEvents.length === 0 ? (
                <p className="text-[13px] text-[#64748B]">Nothing scheduled.</p>
              ) : (
                selectedEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={event.href}
                    className="block rounded-md px-2 py-2 hover:bg-[#F8FAFC]"
                  >
                    <p className="text-[13px] font-medium text-[#172033]">
                      {event.title}
                    </p>
                    <p className="text-[12px] text-[#64748B]">
                      {event.type} · {formatDateTime(event.startAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
