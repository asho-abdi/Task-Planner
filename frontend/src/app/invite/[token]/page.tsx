"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { AuthCard, AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser, useRegister } from "@/features/auth/hooks";
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useInvitationPreview,
} from "@/features/workspaces/hooks";
import { getAccessToken } from "@/lib/session";

export default function InviteTokenPage() {
  return (
    <Suspense>
      <InviteTokenContent />
    </Suspense>
  );
}

function InviteTokenContent() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const preview = useInvitationPreview(token);
  const currentUser = useCurrentUser(Boolean(getAccessToken()));
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const register = useRegister();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"choose" | "register">("choose");

  const user = currentUser.data ?? null;
  const invitePath = `/invite/${token}`;

  if (preview.isLoading) {
    return (
      <AuthLayout
        eyebrow="Invitation"
        panelTitle="Checking your invite."
        panelDescription="We are loading the workspace you were invited to join."
      >
        <p className="text-sm text-muted-foreground">Loading invitation…</p>
      </AuthLayout>
    );
  }

  if (preview.error || !preview.data) {
    return (
      <AuthLayout
        eyebrow="Invitation"
        panelTitle="This invite is no longer available."
        panelDescription="The link may have expired, been revoked, or already used."
      >
        <AuthCard>
          <h2 className="text-2xl font-semibold tracking-tight">
            Invitation unavailable
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {preview.error?.message ?? "This invitation is invalid or expired."}
          </p>
          <Button className="mt-6" asChild>
            <Link href="/login">Go to sign in</Link>
          </Button>
        </AuthCard>
      </AuthLayout>
    );
  }

  const invite = preview.data;
  const emailMatches =
    user?.email.toLowerCase() === invite.email.toLowerCase();

  async function handleAccept() {
    await accept.mutateAsync(token);
    router.replace("/app");
  }

  async function handleDecline() {
    await decline.mutateAsync({ token });
    router.replace(user ? "/app" : "/login");
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    await register.mutateAsync({
      name,
      email: invite.email,
      password,
      inviteToken: token,
    });
  }

  return (
    <AuthLayout
      eyebrow="Invitation"
      panelTitle={`Join ${invite.workspace.name}.`}
      panelDescription={`You were invited as ${invite.role.toLowerCase()}. The invite is tied to ${invite.email}.`}
    >
      <InviteBody title={`Join ${invite.workspace.name}`} description={`Invited as ${invite.role.toLowerCase()} · ${invite.email}`}>
        {!user ? (
          mode === "register" ? (
            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={invite.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {register.error ? (
                <p className="text-sm text-destructive">{register.error.message}</p>
              ) : null}
              <Button className="w-full" type="submit" disabled={register.isPending}>
                {register.isPending ? "Creating account..." : "Create account and join"}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode("choose")}
              >
                Back
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Create an account or sign in with {invite.email} to accept.
              </p>
              <Button className="w-full" onClick={() => setMode("register")}>
                Create account
              </Button>
              <Button className="w-full" variant="outline" asChild>
                <Link href={`/login?next=${encodeURIComponent(invitePath)}`}>
                  Sign in
                </Link>
              </Button>
            </div>
          )
        ) : !emailMatches ? (
          <p className="mt-6 text-sm text-destructive">
            This invitation was sent to {invite.email}. You are signed in as{" "}
            {user.email}.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => void handleAccept()}
              disabled={accept.isPending}
            >
              {accept.isPending ? "Joining..." : "Accept"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleDecline()}
              disabled={decline.isPending}
            >
              Decline
            </Button>
          </div>
        )}
        {accept.error ? (
          <p className="mt-3 text-sm text-destructive">{accept.error.message}</p>
        ) : null}
        {decline.error ? (
          <p className="mt-3 text-sm text-destructive">{decline.error.message}</p>
        ) : null}
      </InviteBody>
    </AuthLayout>
  );
}

function InviteBody({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <AuthCard>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </AuthCard>
  );
}
