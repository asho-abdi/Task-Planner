"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Team } from "@/features/collaboration/types";
import type { WorkloadUser } from "@/features/insights/types";
import { cn } from "@/lib/utils";

export type PickerPerson = {
  userId: string;
  name: string;
};

function teamMemberIds(team: Team) {
  const ids = team.members.map((member) => member.userId);
  if (team.ownerId && !ids.includes(team.ownerId)) {
    ids.unshift(team.ownerId);
  }
  return [...new Set(ids)];
}

export function PeoplePicker({
  label,
  hint,
  people,
  teams = [],
  selectedIds,
  onChange,
  loading,
  disabled,
  workloadUsers,
  placeholder = "Search people or teams...",
}: {
  label: string;
  hint?: string;
  people: PickerPerson[];
  teams?: Team[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  workloadUsers?: WorkloadUser[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = `people-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const loadByUser = new Map(
    (workloadUsers ?? []).map((user) => [user.userId, user]),
  );
  const peopleById = new Map(people.map((person) => [person.userId, person]));

  useEffect(() => {
    function close(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const activeTeams = useMemo(
    () =>
      teams.filter((team) => {
        if (!teamIds.includes(team.id)) return false;
        const ids = teamMemberIds(team);
        return ids.length > 0 && ids.every((id) => selectedSet.has(id));
      }),
    [teams, teamIds, selectedSet],
  );

  const coveredByTeam = useMemo(() => {
    const ids = new Set<string>();
    for (const team of activeTeams) {
      for (const id of teamMemberIds(team)) ids.add(id);
    }
    return ids;
  }, [activeTeams]);

  const personChips = selectedIds.filter((id) => !coveredByTeam.has(id));

  const q = query.trim().toLowerCase();
  const teamHits = teams.filter((team) => {
    if (activeTeams.some((item) => item.id === team.id)) return false;
    if (!q) return true;
    return team.name.toLowerCase().includes(q);
  });
  const peopleHits = people.filter((person) => {
    if (selectedSet.has(person.userId)) return false;
    if (!q) return true;
    return person.name.toLowerCase().includes(q);
  });

  function addIds(ids: string[]) {
    onChange([...new Set([...selectedIds, ...ids])]);
  }

  function addPerson(userId: string) {
    addIds([userId]);
    setQuery("");
    setOpen(true);
  }

  function addTeam(team: Team) {
    const ids = teamMemberIds(team);
    if (!ids.length) return;
    setTeamIds((current) =>
      current.includes(team.id) ? current : [...current, team.id],
    );
    addIds(ids);
    setQuery("");
    setOpen(true);
  }

  function removePerson(userId: string) {
    onChange(selectedIds.filter((id) => id !== userId));
  }

  function removeTeam(team: Team) {
    const ids = new Set(teamMemberIds(team));
    setTeamIds((current) => current.filter((id) => id !== team.id));
    onChange(selectedIds.filter((id) => !ids.has(id)));
  }

  const hasChips = activeTeams.length > 0 || personChips.length > 0;

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="space-y-1">
        <Label htmlFor={inputId}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {loading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <div
          className={cn(
            "rounded-md border border-input bg-card shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
            disabled && "opacity-60",
          )}
        >
          {hasChips ? (
            <div className="flex flex-wrap gap-1.5 px-2 pt-2">
              {activeTeams.map((team) => (
                <Chip
                  key={`team-${team.id}`}
                  label={`${team.name} · ${teamMemberIds(team).length}`}
                  team
                  disabled={disabled}
                  onRemove={() => removeTeam(team)}
                />
              ))}
              {personChips.map((id) => (
                <Chip
                  key={id}
                  label={peopleById.get(id)?.name ?? "Member"}
                  disabled={disabled}
                  onRemove={() => removePerson(id)}
                />
              ))}
            </div>
          ) : null}
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
            />
            <input
              id={inputId}
              value={query}
              disabled={disabled}
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls={`${inputId}-list`}
              className="h-9 w-full rounded-md bg-transparent pl-8 pr-3 text-base text-foreground placeholder:text-subtle-foreground focus:outline-none disabled:cursor-not-allowed"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  return;
                }
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (teamHits[0]) addTeam(teamHits[0]);
                else if (peopleHits[0]) addPerson(peopleHits[0].userId);
              }}
            />
          </div>
          {open ? (
            <div
              id={`${inputId}-list`}
              role="listbox"
              className="max-h-56 overflow-y-auto border-t border-border p-1 animate-fade-in"
            >
              {teamHits.length ? (
                <div>
                  <p className="px-2 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                    Teams
                  </p>
                  {teamHits.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-base transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      onClick={() => addTeam(team)}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                        <Users className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {team.name}
                      </span>
                      <span className="text-xs text-muted-foreground tabular">
                        {teamMemberIds(team).length} people
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {peopleHits.length ? (
                <div>
                  <p className="px-2 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-subtle-foreground">
                    People
                  </p>
                  {peopleHits.map((person) => {
                    const load = loadByUser.get(person.userId);
                    const percent = load
                      ? Math.min(100, Math.round(load.utilization * 100))
                      : null;
                    return (
                      <button
                        key={person.userId}
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-base transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        onClick={() => addPerson(person.userId)}
                      >
                        <Avatar name={person.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {person.name}
                        </span>
                        {percent != null ? (
                          <span
                            className="flex items-center gap-1.5"
                            title={`${percent}% of capacity${load?.overloaded ? " · overloaded" : ""}`}
                          >
                            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                              <span
                                className={cn(
                                  "block h-full rounded-full",
                                  load?.overloaded
                                    ? "bg-danger"
                                    : percent >= 80
                                      ? "bg-warning"
                                      : "bg-success",
                                )}
                                style={{ width: `${percent}%` }}
                              />
                            </span>
                            <span
                              className={cn(
                                "w-9 text-right text-xs tabular",
                                load?.overloaded
                                  ? "font-medium text-danger-soft-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {percent}%
                            </span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!teamHits.length && !peopleHits.length ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  No matching people or teams.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  team,
  disabled,
  onRemove,
}: {
  label: string;
  team?: boolean;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted pl-0.5 pr-1 text-xs font-medium text-foreground">
      {team ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <Users className="size-3" />
        </span>
      ) : (
        <Avatar name={label} size="xs" />
      )}
      <span className="max-w-40 truncate">{label}</span>
      <button
        type="button"
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
