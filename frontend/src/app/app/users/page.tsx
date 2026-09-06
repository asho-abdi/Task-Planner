"use client";

import { EmptyState, PageHeader, PageShell, Surface } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";
import { usePlatformUsers } from "@/features/collaboration/hooks";
import { useCurrentUser } from "@/features/auth/hooks";

export default function UsersPage() {
  const me = useCurrentUser();
  const allowed =
    me.data?.role === "SUPER_ADMIN" || me.data?.role === "ADMIN";
  const users = usePlatformUsers(Boolean(allowed));

  if (me.isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }

  if (!allowed) {
    return (
      <PageShell>
        <PageHeader title="Users" />
        <p className="text-sm text-muted-foreground">
          Platform user lists are limited to system admins.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Users"
        description="Accounts on this installation. Workspace membership is managed in Settings."
      />
      {users.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : users.isError ? (
        <p className="text-sm text-destructive">{users.error.message}</p>
      ) : !users.data?.length ? (
        <EmptyState title="No users" />
      ) : (
        <div className="space-y-3">
          {users.data.map((user) => (
            <Surface key={user.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <StatusBadge value={user.role} />
            </Surface>
          ))}
        </div>
      )}
    </PageShell>
  );
}
