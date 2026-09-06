"use client";

import {
  useAcceptMyInvitation,
  useDeclineInvitation,
  useMyInvitations,
} from "@/features/workspaces/hooks";
import { Button } from "@/components/ui/button";

export function PendingInvitesBanner() {
  const invites = useMyInvitations();
  const accept = useAcceptMyInvitation();
  const decline = useDeclineInvitation();
  const items = invites.data ?? [];

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3">
      <p className="text-sm font-medium">Pending workspace invitations</p>
      <ul className="mt-3 space-y-2">
        {items.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-muted-foreground">
              {invite.workspace.name} · {invite.role}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={accept.isPending}
                onClick={() => void accept.mutateAsync(invite.id)}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={decline.isPending}
                onClick={() =>
                  void decline.mutateAsync({ invitationId: invite.id })
                }
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
