"use client";

import type { ReactNode } from "react";
import { useState, type FormEvent } from "react";
import { Field, FormActions } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
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

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field label="Title" htmlFor="meeting-title">
        <Input
          id="meeting-title"
          value={values.title}
          onChange={(event) => update("title", event.target.value)}
          autoFocus
          required
        />
      </Field>
      <Field label="Description" htmlFor="meeting-description">
        <textarea
          id="meeting-description"
          className={nativeTextareaClass}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
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
      <Field label="Meeting type">
        <div className="grid grid-cols-2 gap-2">
          {(["ONLINE", "OFFLINE"] as MeetingMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm ${
                values.mode === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card"
              }`}
              onClick={() => update("mode", mode)}
            >
              {mode === "ONLINE" ? "Online" : "Offline"}
            </button>
          ))}
        </div>
      </Field>
      {values.mode === "ONLINE" ? (
        <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="grid gap-3 sm:grid-cols-2">
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
              {item === "NONE" ? "Does not repeat" : item.toLowerCase()}
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
      {values.recurrence === "CUSTOM" ? (
        <Field label="Weekdays">
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, index) => (
              <label
                key={label}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={values.recurrenceWeekdays.includes(index)}
                  onChange={(event) =>
                    update(
                      "recurrenceWeekdays",
                      event.target.checked
                        ? [...values.recurrenceWeekdays, index]
                        : values.recurrenceWeekdays.filter((day) => day !== index),
                    )
                  }
                />
                {label.slice(0, 3)}
              </label>
            ))}
          </div>
        </Field>
      ) : null}
      <Field label="Reminders">
        <div className="grid gap-2 sm:grid-cols-2">
          {REMIND_MINUTE_OPTIONS.map((minutes) => (
            <label key={minutes} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.remindMinutes.includes(minutes)}
                onChange={(event) =>
                  update(
                    "remindMinutes",
                    event.target.checked
                      ? [...values.remindMinutes, minutes]
                      : values.remindMinutes.filter((item) => item !== minutes),
                  )
                }
              />
              {REMIND_LABELS[minutes]}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Agenda">
        <div className="space-y-2">
          {values.agendaItems.map((item, index) => (
            <div key={`agenda-${index}`} className="flex gap-2">
              <span className="mt-2 w-5 text-xs text-muted-foreground">
                {index + 1}.
              </span>
              <Input
                value={item}
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
                size="sm"
                onClick={() =>
                  update(
                    "agendaItems",
                    values.agendaItems.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update("agendaItems", [...values.agendaItems, ""])}
          >
            Add agenda item
          </Button>
        </div>
      </Field>
      <Field label="Participants" loading={members.isLoading}>
        <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-border p-3">
          {(members.data ?? []).map((member) => {
            const selected = values.participants.find(
              (item) => item.userId === member.userId,
            );
            return (
              <div
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={() => upsertParticipant(member.userId)}
                  />
                  {member.user.name}
                </label>
                {selected ? (
                  <select
                    className="h-8 rounded-md border border-border bg-card px-2 text-xs"
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
              </div>
            );
          })}
          {!members.isLoading && (members.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : null}
        </div>
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <FormActions>
        {extraActions}
        <Button type="submit" disabled={!values.title.trim() || submitting}>
          {submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
