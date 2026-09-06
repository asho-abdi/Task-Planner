"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Team } from "@/features/collaboration/types";
import { workloadGlyph } from "@/features/insights/ui";
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

  return (
    <div className="space-y-2" ref={rootRef}>
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {loading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-2">
          <div className="flex flex-wrap gap-1.5">
            {activeTeams.map((team) => (
              <Chip
                key={`team-${team.id}`}
                label={`${team.name} · ${teamMemberIds(team).length}`}
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
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              value={query}
              disabled={disabled}
              placeholder={placeholder}
              autoComplete="off"
              className="h-9 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
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
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[#E5E7EB]">
              {teamHits.length ? (
                <div className="p-1">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                    Teams
                  </p>
                  {teamHits.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#F8FAFC]"
                      onClick={() => addTeam(team)}
                    >
                      <Users className="h-4 w-4 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {team.name}
                      </span>
                      <span className="text-xs text-[#64748B]">
                        {teamMemberIds(team).length} people
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {peopleHits.length ? (
                <div className="p-1">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
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
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#F8FAFC]"
                        onClick={() => addPerson(person.userId)}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {person.name}
                        </span>
                        {percent != null ? (
                          <span
                            className={cn(
                              "font-mono text-xs",
                              load?.overloaded
                                ? "text-[#EF4444]"
                                : "text-[#64748B]",
                            )}
                          >
                            {workloadGlyph(percent)} {percent}%
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!teamHits.length && !peopleHits.length ? (
                <p className="px-3 py-2 text-sm text-[#64748B]">
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
  disabled,
  onRemove,
}: {
  label: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-2 py-0.5 text-xs font-medium text-[#172033]">
      {label}
      <button
        type="button"
        className="rounded-full p-0.5 text-[#64748B] hover:bg-white hover:text-[#172033]"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
