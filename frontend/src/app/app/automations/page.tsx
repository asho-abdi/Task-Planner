"use client";

import { useState, type FormEvent } from "react";
import {
  AlarmClock,
  ArrowRight,
  Bell,
  CalendarPlus,
  CircleCheck,
  Megaphone,
  Plus,
  SquarePlus,
  Trash2,
  UserRound,
  UserRoundCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useUpdateAutomation,
} from "@/features/collaboration/hooks";
import { Switch } from "@/features/collaboration/switch";
import { useCurrentWorkspace } from "@/features/workspaces/hooks";
import { cn, nativeSelectClass } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const TRIGGERS = [
  { value: "TASK_CREATED", label: "When a task is created", short: "a task is created", icon: SquarePlus },
  { value: "TASK_COMPLETED", label: "When a task is completed", short: "a task is completed", icon: CircleCheck },
  { value: "TASK_OVERDUE", label: "When a task becomes overdue", short: "a task becomes overdue", icon: AlarmClock },
  { value: "MEETING_CREATED", label: "When a meeting is created", short: "a meeting is created", icon: CalendarPlus },
] as const;

const ACTIONS = [
  { value: "NOTIFY_ASSIGNEE", label: "Notify assignee", icon: UserRoundCheck },
  { value: "NOTIFY_OWNER", label: "Notify owner", icon: UserRound },
  { value: "NOTIFY_WORKSPACE", label: "Notify workspace", icon: Megaphone },
  { value: "SEND_NOTIFICATION", label: "Send in-app notification", icon: Bell },
] as const;

type Option = { value: string; label: string; icon: LucideIcon; short?: string };

function optionFor(list: readonly Option[], value: string): Option {
  return list.find((item) => item.value === value) ?? { value, label: value, icon: Zap };
}

function RuleChip({
  icon: Icon,
  children,
  tone,
}: {
  icon: LucideIcon;
  children: string;
  tone: "trigger" | "action";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium",
        tone === "trigger"
          ? "border-warning/25 bg-warning-soft text-warning-soft-foreground"
          : "border-info/25 bg-info-soft text-info-soft-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
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
    const ruleName = name.trim();
    await createAutomation.mutateAsync({
      name: ruleName,
      trigger,
      action,
    });
    setName("");
    toast.success(`Automation “${ruleName}” created`);
  }

  const list = automations.data ?? [];
  const enabledCount = list.filter((item) => item.enabled).length;
  const previewTrigger = optionFor(TRIGGERS, trigger);
  const previewAction = optionFor(ACTIONS, action);

  return (
    <PageShell>
      <PageHeader
        title="Automations"
        icon={Zap}
        description="Notify people when work is created, completed, or overdue."
        meta={
          list.length ? (
            <span className="tabular">
              {enabledCount} of {list.length} active
            </span>
          ) : null
        }
      />

      {canAdmin ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="font-heading text-md font-semibold tracking-[-0.02em] text-foreground">
              New automation
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick a trigger and what should happen.
            </p>
          </div>
          <form className="space-y-4 p-4 sm:p-5" onSubmit={onCreate}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="automation-name">Name</Label>
                <Input
                  id="automation-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Notify assignee on complete"
                  required
                />
              </div>
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <span>When</span>
                <RuleChip icon={previewTrigger.icon} tone="trigger">
                  {previewTrigger.short ?? previewTrigger.label}
                </RuleChip>
                <ArrowRight className="size-3.5 text-subtle-foreground" aria-label="then" />
                <RuleChip icon={previewAction.icon} tone="action">
                  {previewAction.label}
                </RuleChip>
              </p>
              <Button
                type="submit"
                loading={createAutomation.isPending}
                disabled={!name.trim()}
                className="self-start sm:self-auto"
              >
                <Plus />
                Add automation
              </Button>
            </div>
            {createAutomation.error ? (
              <p className="text-sm text-danger-soft-foreground">
                {createAutomation.error.message}
              </p>
            ) : null}
          </form>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Only workspace owners and admins can create automations.
        </p>
      )}

      {automations.isLoading ? (
        <div role="status" aria-label="Loading automations" className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-6 w-72 max-w-full" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </div>
      ) : automations.isError ? (
        <ErrorState
          title="Couldn't load automations"
          description={automations.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void automations.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !list.length ? (
        <EmptyState
          icon={Zap}
          title="No automations yet"
          description="Create a rule to notify people when tasks or meetings change."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((item) => {
            const triggerOption = optionFor(TRIGGERS, item.trigger);
            const actionOption = optionFor(ACTIONS, item.action);
            const toggling =
              updateAutomation.isPending &&
              updateAutomation.variables?.automationId === item.id;
            const deleting =
              deleteAutomation.isPending && deleteAutomation.variables === item.id;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors duration-150 sm:flex-row sm:items-center sm:gap-4 sm:p-5",
                  !item.enabled && "bg-muted/40",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                      item.enabled
                        ? "bg-primary-soft text-primary-soft-foreground"
                        : "bg-muted text-subtle-foreground",
                    )}
                  >
                    <Zap className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        id={`automation-${item.id}-name`}
                        className={cn(
                          "truncate text-base font-semibold",
                          item.enabled ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {item.name}
                      </p>
                      <Badge variant={item.enabled ? "success" : "default"} dot>
                        {item.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        "flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground",
                        !item.enabled && "opacity-70",
                      )}
                    >
                      <span>When</span>
                      <RuleChip icon={triggerOption.icon} tone="trigger">
                        {triggerOption.short ?? triggerOption.label}
                      </RuleChip>
                      <ArrowRight
                        className="size-3.5 text-subtle-foreground"
                        aria-label="then"
                      />
                      <RuleChip icon={actionOption.icon} tone="action">
                        {actionOption.label}
                      </RuleChip>
                    </p>
                  </div>
                </div>
                {canAdmin ? (
                  <div className="flex items-center justify-end gap-2 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                    <Switch
                      checked={item.enabled}
                      disabled={toggling}
                      aria-labelledby={`automation-${item.id}-name`}
                      onCheckedChange={(enabled) =>
                        void updateAutomation
                          .mutateAsync({ automationId: item.id, enabled })
                          .then(() =>
                            toast.success(
                              `“${item.name}” ${enabled ? "enabled" : "paused"}`,
                            ),
                          )
                          .catch(() => undefined)
                      }
                    />
                    <Tooltip content="Delete automation">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${item.name}`}
                        loading={deleting}
                        className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                        onClick={() => {
                          if (!window.confirm("Delete this automation?")) return;
                          void deleteAutomation
                            .mutateAsync(item.id)
                            .then(() => toast.success("Automation deleted"))
                            .catch(() => undefined);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </Tooltip>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
