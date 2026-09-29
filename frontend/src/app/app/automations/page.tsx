"use client";

import { useState, type FormEvent } from "react";
import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useUpdateAutomation,
} from "@/features/collaboration/hooks";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { nativeSelectClass } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const TRIGGERS = [
  { value: "TASK_CREATED", label: "When a task is created" },
  { value: "TASK_COMPLETED", label: "When a task is completed" },
  { value: "TASK_OVERDUE", label: "When a task becomes overdue" },
  { value: "MEETING_CREATED", label: "When a meeting is created" },
] as const;

const ACTIONS = [
  { value: "NOTIFY_ASSIGNEE", label: "Notify assignee" },
  { value: "NOTIFY_OWNER", label: "Notify owner" },
  { value: "NOTIFY_WORKSPACE", label: "Notify workspace" },
  { value: "SEND_NOTIFICATION", label: "Send in-app notification" },
] as const;

function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((item) => item.value === value)?.label ?? value;
}

export default function AutomationsPage() {
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const workspace = useCurrentWorkspace();
  const automations = useAutomations(workspaceId);
  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const canAdmin = workspace?.role === "OWNER" || workspace?.role === "ADMIN";
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<(typeof TRIGGERS)[number]["value"]>(
    "TASK_COMPLETED",
  );
  const [action, setAction] = useState<(typeof ACTIONS)[number]["value"]>(
    "NOTIFY_ASSIGNEE",
  );

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    await createAutomation.mutateAsync({
      name: name.trim(),
      trigger,
      action,
    });
    setName("");
  }

  return (
    <PageShell>
      <PageHeader
        title="Automations"
        description="Notify people when work is created, completed, or overdue."
      />
      {canAdmin ? (
        <Surface>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={onCreate}>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="automation-name">Name</Label>
              <Input
                id="automation-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Notify assignee on complete"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="automation-trigger">Trigger</Label>
              <select
                id="automation-trigger"
                className={nativeSelectClass}
                value={trigger}
                onChange={(event) =>
                  setTrigger(event.target.value as (typeof TRIGGERS)[number]["value"])
                }
              >
                {TRIGGERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="automation-action">Action</Label>
              <select
                id="automation-action"
                className={nativeSelectClass}
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as (typeof ACTIONS)[number]["value"])
                }
              >
                {ACTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={createAutomation.isPending || !name.trim()}>
                {createAutomation.isPending ? "Saving…" : "Add automation"}
              </Button>
            </div>
          </form>
          {createAutomation.error ? (
            <p className="mt-3 text-sm text-destructive">
              {createAutomation.error.message}
            </p>
          ) : null}
        </Surface>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only workspace owners and admins can create automations.
        </p>
      )}
      {automations.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : automations.isError ? (
        <p className="text-sm text-destructive">{automations.error.message}</p>
      ) : !(automations.data ?? []).length ? (
        <EmptyState
          title="No automations yet"
          description="Create a rule to notify people when tasks or meetings change."
        />
      ) : (
        <div className="space-y-3">
          {(automations.data ?? []).map((item) => (
            <Surface
              key={item.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-[#172033]">{item.name}</p>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  {labelFor(TRIGGERS, item.trigger)} · {labelFor(ACTIONS, item.action)}
                </p>
              </div>
              {canAdmin ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateAutomation.isPending}
                    onClick={() =>
                      void updateAutomation.mutate({
                        automationId: item.id,
                        enabled: !item.enabled,
                      })
                    }
                  >
                    {item.enabled ? "On" : "Off"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteAutomation.isPending}
                    onClick={() => {
                      if (!window.confirm("Delete this automation?")) return;
                      void deleteAutomation.mutate(item.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {item.enabled ? "Enabled" : "Disabled"}
                </p>
              )}
            </Surface>
          ))}
        </div>
      )}
    </PageShell>
  );
}
