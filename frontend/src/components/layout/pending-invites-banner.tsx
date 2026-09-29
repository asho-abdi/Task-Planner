"use client";

import { MailPlus } from "lucide-react";
import {
  useAcceptMyInvitation,
  useDeclineInvitation,
  useMyInvitations,
} from "@/features/workspaces/hooks";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function PendingInvitesBanner() {
  const invites = useMyInvitations();
  const accept = useAcceptMyInvitation();
  const decline = useDeclineInvitation();
  const items = invites.data ?? [];

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Pending workspace invitations"
      className="mx-auto mb-6 max-w-[1200px] animate-slide-up rounded-xl border border-primary/20 bg-primary-soft/60 px-4 py-3"
    >
      <div className="flex items-center gap-2 text-primary-soft-foreground">
        <MailPlus className="size-4" />
        <p className="text-base font-medium">
          You have {items.length} pending workspace{" "}
          {items.length === 1 ? "invitation" : "invitations"}
        </p>
      </div>
      <ul className="mt-2 divide-y divide-primary/10">
        {items.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-base text-foreground">
              <span className="font-medium">{invite.workspace.name}</span>
              <span className="text-muted-foreground"> · joining as {invite.role.toLowerCase()}</span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={accept.isPending && accept.variables === invite.id}
                disabled={accept.isPending}
                onClick={() =>
                  void accept
                    .mutateAsync(invite.id)
                    .then(() => toast.success(`Joined ${invite.workspace.name}`))
                    .catch(() => undefined)
                }
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={decline.isPending}
                onClick={() =>
                  void decline
                    .mutateAsync({ invitationId: invite.id })
                    .then(() => toast("Invitation declined"))
                    .catch(() => undefined)
                }
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
