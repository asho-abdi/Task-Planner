"use client";

import type { ReactNode } from "react";
import { useState, type FormEvent } from "react";
import {
  Bell,
  CalendarClock,
  ListChecks,
  MapPin,
  Plus,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { Field, FormActions } from "@/components/form-fields";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { useTeams } from "@/features/collaboration/hooks";
import type { useProjects } from "@/features/projects/hooks";
import {
  MEETING_PROVIDERS,
  MEETING_RECURRENCES,
  PROVIDER_LABELS,
  REMIND_LABELS,
  REMIND_MINUTE_OPTIONS,
  WEEKDAY_LABELS,
  type Meeting,
  type MeetingFormValues,
  type MeetingMode,
  type MeetingParticipantKind,
  type MeetingWriteInput,
} from "@/features/meetings/types";
import type { useWorkspaceMembers } from "@/features/workspaces/hooks";
import {
  cn,
  fromDateTimeLocalValue,
  localDateYmd,
  nativeSelectClass,
  nativeTextareaClass,
} from "@/lib/utils";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return "";
  return fromDateTimeLocalValue(`${date}T${time}`) ?? "";
}

export const emptyMeetingForm = (): MeetingFormValues => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: "",
    description: "",
    date: localDateYmd(start),
    startTime: toTimeValue(start),
    endTime: toTimeValue(end),
    mode: "ONLINE",
    meetingProvider: "GOOGLE_MEET",
    meetingUrl: "",
    location: "",
    room: "",
    address: "",
    mapUrl: "",
    projectId: "",
    teamId: "",
    notes: "",
    participants: [],
    agendaItems: [""],
    remindMinutes: [15],
    recurrence: "NONE",
    recurrenceUntil: "",
    recurrenceWeekdays: [start.getDay()],
  };
};

export function meetingToFormValues(meeting: Meeting): MeetingFormValues {
  const start = new Date(meeting.startAt);
  const end = new Date(meeting.endAt);
  const participants = meeting.participants.map((item) => ({
    userId: item.userId ?? item.id,
    kind: item.kind ?? "REQUIRED",
  }));
  return {
    title: meeting.title,
    description: meeting.description ?? "",
    date: localDateYmd(start),
    startTime: toTimeValue(start),
    endTime: toTimeValue(end),
    mode: meeting.mode ?? (meeting.meetingLink || meeting.meetingUrl ? "ONLINE" : "OFFLINE"),
    meetingProvider: meeting.meetingProvider ?? "",
    meetingUrl: meeting.meetingUrl ?? meeting.meetingLink ?? "",
    location: meeting.location ?? "",
    room: meeting.room ?? "",
    address: meeting.address ?? "",
    mapUrl: meeting.mapUrl ?? "",
    projectId: meeting.projectId ?? "",
    teamId: meeting.teamId ?? "",
    notes: meeting.notes ?? "",
    participants,
    agendaItems: meeting.agenda.length
      ? meeting.agenda.map((item) => item.title)
      : [""],
    remindMinutes: meeting.remindMinutes?.length ? meeting.remindMinutes : [15],
    recurrence: meeting.recurrence ?? "NONE",
    recurrenceUntil: meeting.recurrenceUntil
      ? localDateYmd(new Date(meeting.recurrenceUntil))
      : "",
    recurrenceWeekdays: (() => {
      const stored = meeting.recurrenceWeekdays ?? [];
      if (!stored.length) return [start.getDay()];
      const delta = (start.getUTCDay() - start.getDay() + 7) % 7;
      return stored.map((day) => (day - delta + 7) % 7);
    })(),
  };
}

export function toMeetingWriteInput(
  values: MeetingFormValues,
): MeetingWriteInput {
  const startAt = combineDateAndTime(values.date, values.startTime);
  const endAt = combineDateAndTime(values.date, values.endTime);
  const agenda = values.agendaItems.map((item) => item.trim()).filter(Boolean);
  const isOnline = values.mode === "ONLINE";
  const startLocal = new Date(`${values.date}T${values.startTime}`);
  const startUtc = new Date(startAt);
  const weekdayDelta =
    Number.isNaN(startLocal.getTime()) || Number.isNaN(startUtc.getTime())
      ? 0
      : (startUtc.getUTCDay() - startLocal.getDay() + 7) % 7;
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    startAt,
    endAt,
    mode: values.mode,
    meetingProvider: isOnline
      ? values.meetingProvider || "CUSTOM"
      : null,
    meetingUrl: isOnline ? values.meetingUrl.trim() || undefined : null,
    location: !isOnline ? values.location.trim() || undefined : null,
    room: !isOnline ? values.room.trim() || undefined : null,
    address: !isOnline ? values.address.trim() || undefined : null,
    mapUrl: !isOnline ? values.mapUrl.trim() || undefined : null,
    projectId: values.projectId || undefined,
    teamId: values.teamId || undefined,
    notes: values.notes.trim() || undefined,
    participants: values.participants,
    agenda,
    remindMinutes: values.remindMinutes,
    recurrence: values.recurrence,
    recurrenceUntil: values.recurrenceUntil
      ? `${values.recurrenceUntil}T23:59:59.000Z`
      : null,
    recurrenceWeekdays:
      values.recurrence === "CUSTOM"
        ? values.recurrenceWeekdays.map((day) => (day + weekdayDelta) % 7)
        : [],
  };
}

type MeetingFormProps = {
  initial: MeetingFormValues;
  projects: ReturnType<typeof useProjects>;
  members: ReturnType<typeof useWorkspaceMembers>;
  teams?: ReturnType<typeof useTeams>;
  submitting: boolean;
  submitLabel: string;
  error?: string;
  onSubmit: (values: MeetingFormValues) => Promise<void>;
  extraActions?: ReactNode;
};

export function MeetingForm({
  initial,
  projects,
  members,
  teams,
  submitting,
  submitLabel,
  error,
  onSubmit,
  extraActions,
}: MeetingFormProps) {
  const [values, setValues] = useState(initial);

  function update<K extends keyof MeetingFormValues>(
    key: K,
    value: MeetingFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function upsertParticipant(userId: string, kind?: MeetingParticipantKind) {
    setValues((current) => {
      const existing = current.participants.find((item) => item.userId === userId);
      if (!existing) {
        return {
          ...current,
          participants: [
            ...current.participants,
            { userId, kind: kind ?? "REQUIRED" },
          ],
        };
      }
      if (!kind) {
        return {
          ...current,
          participants: current.participants.filter((item) => item.userId !== userId),
        };
      }
      return {
        ...current,
        participants: current.participants.map((item) =>
          item.userId === userId ? { ...item, kind } : item,
        ),
      };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  const selectedCount = values.participants.length;

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <Field label="Title" htmlFor="meeting-title">
          <Input
            id="meeting-title"
            value={values.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Weekly design sync"
            autoFocus
            required
          />
        </Field>
        <Field label="Description" htmlFor="meeting-description">
          <textarea
            id="meeting-description"
            className={cn(nativeTextareaClass, "min-h-20")}
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="What is this meeting about? (optional)"
          />
        </Field>
      </div>

      <FormSection icon={CalendarClock} title="When">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="meeting-date">
            <Input
              id="meeting-date"
              type="date"
              value={values.date}
              onChange={(event) => update("date", event.target.value)}
              required
            />
          </Field>
          <Field label="Start time" htmlFor="meeting-start-time">
            <Input
              id="meeting-start-time"
              type="time"
              value={values.startTime}
              onChange={(event) => update("startTime", event.target.value)}
              required
            />
          </Field>
          <Field label="End time" htmlFor="meeting-end-time">
            <Input
              id="meeting-end-time"
              type="time"
              value={values.endTime}
              onChange={(event) => update("endTime", event.target.value)}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Recurrence" htmlFor="meeting-recurrence">
            <select
              id="meeting-recurrence"
              className={nativeSelectClass}
              value={values.recurrence}
              onChange={(event) =>
                update(
                  "recurrence",
                  event.target.value as MeetingFormValues["recurrence"],
                )
              }
            >
              {MEETING_RECURRENCES.map((item) => (
                <option key={item} value={item}>
                  {item === "NONE"
                    ? "Does not repeat"
                    : item.charAt(0) + item.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          {values.recurrence !== "NONE" ? (
            <Field label="Repeat until" htmlFor="meeting-until">
              <Input
                id="meeting-until"
                type="date"
                value={values.recurrenceUntil}
                onChange={(event) => update("recurrenceUntil", event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        {values.recurrence === "CUSTOM" ? (
          <Field label="Weekdays">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
              {WEEKDAY_LABELS.map((label, index) => (
                <ToggleChip
                  key={label}
                  checked={values.recurrenceWeekdays.includes(index)}
                  title={label}
                  onChange={(checked) =>
                    update(
                      "recurrenceWeekdays",
                      checked
                        ? [...values.recurrenceWeekdays, index]
                        : values.recurrenceWeekdays.filter((day) => day !== index),
                    )
                  }
                >
                  {label.slice(0, 3)}
                </ToggleChip>
              ))}
            </div>
          </Field>
        ) : null}
      </FormSection>

      <FormSection icon={values.mode === "ONLINE" ? Video : MapPin} title="Where">
        <div
          role="radiogroup"
          aria-label="Meeting type"
          className="grid grid-cols-2 gap-2"
        >
          {(["ONLINE", "OFFLINE"] as MeetingMode[]).map((mode) => {
            const active = values.mode === mode;
            const Icon = mode === "ONLINE" ? Video : MapPin;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
                onClick={() => update("mode", mode)}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-base font-medium">
                    {mode === "ONLINE" ? "Online" : "In person"}
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs sm:block",
                      active ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {mode === "ONLINE" ? "Video call link" : "Office, room or address"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {values.mode === "ONLINE" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provider" htmlFor="meeting-provider">
              <select
                id="meeting-provider"
                className={nativeSelectClass}
                value={values.meetingProvider}
                onChange={(event) =>
                  update(
                    "meetingProvider",
                    event.target.value as MeetingFormValues["meetingProvider"],
                  )
                }
              >
                {MEETING_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {PROVIDER_LABELS[provider]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Meeting URL" htmlFor="meeting-url">
              <Input
                id="meeting-url"
                value={values.meetingUrl}
                onChange={(event) => update("meetingUrl", event.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" htmlFor="meeting-location">
              <Input
                id="meeting-location"
                value={values.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="Office"
              />
            </Field>
            <Field label="Room" htmlFor="meeting-room">
              <Input
                id="meeting-room"
                value={values.room}
                onChange={(event) => update("room", event.target.value)}
                placeholder="Conference Room A"
              />
            </Field>
            <Field label="Address" htmlFor="meeting-address">
              <Input
                id="meeting-address"
                value={values.address}
                onChange={(event) => update("address", event.target.value)}
                placeholder="Main Office"
              />
            </Field>
            <Field label="Map URL" htmlFor="meeting-map">
              <Input
                id="meeting-map"
                value={values.mapUrl}
                onChange={(event) => update("mapUrl", event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={Users}
        title="Who"
        hint={selectedCount ? `${selectedCount} invited` : undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" htmlFor="meeting-project" loading={projects.isLoading}>
            <select
              id="meeting-project"
              className={nativeSelectClass}
              value={values.projectId}
              onChange={(event) => update("projectId", event.target.value)}
            >
              <option value="">No project</option>
              {(projects.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team" htmlFor="meeting-team" loading={teams?.isLoading}>
            <select
              id="meeting-team"
              className={nativeSelectClass}
              value={values.teamId}
              onChange={(event) => update("teamId", event.target.value)}
            >
              <option value="">No team</option>
              {(teams?.data ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Participants" loading={members.isLoading}>
          <ul className="max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border">
            {(members.data ?? []).map((member) => {
              const selected = values.participants.find(
                (item) => item.userId === member.userId,
              );
              const inputId = `meeting-participant-${member.userId}`;
              return (
                <li
                  key={member.userId}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 transition-colors duration-150",
                    selected ? "bg-primary-soft/40" : "hover:bg-muted/60",
                  )}
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    className="size-4 shrink-0 cursor-pointer rounded accent-primary"
                    checked={Boolean(selected)}
                    onChange={() => upsertParticipant(member.userId)}
                  />
                  <label
                    htmlFor={inputId}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-base text-foreground"
                  >
                    <Avatar name={member.user.name} size="sm" />
                    <span className="truncate">{member.user.name}</span>
                  </label>
                  {selected ? (
                    <select
                      aria-label={`${member.user.name} attendance`}
                      className={cn(nativeSelectClass, "h-7 w-auto text-xs")}
                      value={selected.kind}
                      onChange={(event) =>
                        upsertParticipant(
                          member.userId,
                          event.target.value as MeetingParticipantKind,
                        )
                      }
                    >
                      <option value="REQUIRED">Required</option>
                      <option value="OPTIONAL">Optional</option>
                    </select>
                  ) : null}
                </li>
              );
            })}
            {!members.isLoading && (members.data ?? []).length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                No members yet.
              </li>
            ) : null}
          </ul>
        </Field>
      </FormSection>

      <FormSection icon={ListChecks} title="Agenda">
        <ol className="space-y-2">
          {values.agendaItems.map((item, index) => (
            <li key={`agenda-${index}`} className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground tabular">
                {index + 1}
              </span>
              <Input
                value={item}
                aria-label={`Agenda item ${index + 1}`}
                onChange={(event) => {
                  const next = [...values.agendaItems];
                  next[index] = event.target.value;
                  update("agendaItems", next);
                }}
                placeholder="Project progress"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove agenda item ${index + 1}`}
                onClick={() =>
                  update(
                    "agendaItems",
                    values.agendaItems.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => update("agendaItems", [...values.agendaItems, ""])}
        >
          <Plus />
          Add agenda item
        </Button>
      </FormSection>

      <FormSection icon={Bell} title="Reminders">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reminders">
          {REMIND_MINUTE_OPTIONS.map((minutes) => (
            <ToggleChip
              key={minutes}
              checked={values.remindMinutes.includes(minutes)}
              onChange={(checked) =>
                update(
                  "remindMinutes",
                  checked
                    ? [...values.remindMinutes, minutes]
                    : values.remindMinutes.filter((item) => item !== minutes),
                )
              }
            >
              {REMIND_LABELS[minutes]}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      {error ? <ErrorState title="Couldn't save meeting" description={error} /> : null}
      <div className="border-t border-border pt-4">
        <FormActions>
          {extraActions}
          <Button
            type="submit"
            disabled={!values.title.trim()}
            loading={submitting}
          >
            {submitLabel}
          </Button>
        </FormActions>
      </div>
    </form>
  );
}

function FormSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center justify-between gap-2" aria-hidden>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-3.5" />
          </span>
          {title}
        </p>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </fieldset>
  );
}

function ToggleChip({
  checked,
  onChange,
  title,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label
      title={title}
      className={cn(
        "inline-flex h-8 cursor-pointer select-none items-center rounded-md border px-3 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked
          ? "border-primary bg-primary-soft text-primary-soft-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}
