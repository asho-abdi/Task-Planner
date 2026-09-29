"use client";

import { ShieldAlert, UserRound } from "lucide-react";
import { EmptyState, ListPanel, PageHeader, PageShell } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePlatformUsers } from "@/features/collaboration/hooks";
import { useCurrentUser } from "@/features/auth/hooks";
import { formatDate } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MEMBER: "Member",
};

const ROLE_TONE: Record<string, BadgeVariant> = {
  SUPER_ADMIN: "primary",
  ADMIN: "info",
  MEMBER: "default",
};

function PlatformRoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={ROLE_TONE[role] ?? "default"} dot>
      {ROLE_LABEL[role] ?? role}
    </Badge>
  );
}

export default function UsersPage() {
  const me = useCurrentUser();
  const allowed =
    me.data?.role === "SUPER_ADMIN" || me.data?.role === "ADMIN";
  const users = usePlatformUsers(Boolean(allowed));

  if (me.isLoading) {
    return (
      <PageShell>
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <ListPanel>
          <SkeletonList rows={6} />
        </ListPanel>
      </PageShell>
    );
  }

  if (!allowed) {
    return (
      <PageShell>
        <PageHeader title="Users" icon={UserRound} />
        <EmptyState
          icon={ShieldAlert}
          title="Admins only"
          description="Platform user lists are limited to system admins."
        />
      </PageShell>
    );
  }

  const count = users.data?.length ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Users"
        icon={UserRound}
        description="Accounts on this installation. Workspace membership is managed in Settings."
        meta={
          users.data ? (
            <span className="tabular">
              {count} {count === 1 ? "account" : "accounts"}
            </span>
          ) : null
        }
      />
      {users.isLoading ? (
        <ListPanel>
          <SkeletonList rows={6} />
        </ListPanel>
      ) : users.isError ? (
        <ErrorState
          title="Couldn't load users"
          description={users.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => void users.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !users.data?.length ? (
        <ListPanel>
          <EmptyState
            icon={UserRound}
            title="No users"
            description="Accounts appear here once people sign up."
          />
        </ListPanel>
      ) : (
        <ListPanel>
          {/* Mobile: stacked rows */}
          <ul className="divide-y divide-border sm:hidden">
            {users.data.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={user.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-base font-medium text-foreground">
                      {user.name}
                    </p>
                    <PlatformRoleBadge role={user.role} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <p className="tabular text-xs text-subtle-foreground">
                    Joined {formatDate(user.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {/* Desktop: table */}
          <Table containerClassName="hidden sm:block" className="min-w-0">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Platform role</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={user.name} size="sm" />
                      <span className="truncate font-medium text-foreground">
                        {user.name}
                        {user.id === me.data?.id ? (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <PlatformRoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListPanel>
      )}
    </PageShell>
  );
}
