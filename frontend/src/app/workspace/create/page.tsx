"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, AuthLayout } from "@/components/auth/auth-layout";
import { PendingInvitesBanner } from "@/components/layout/pending-invites-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateWorkspace,
  useWorkspaces,
} from "@/features/workspaces/hooks";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { readImageAsDataUrl } from "@/lib/utils";

export default function CreateWorkspacePage() {
  const { user, isLoading } = useRequireAuth();
  const workspaces = useWorkspaces(Boolean(user));
  const createWorkspace = useCreateWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaces.data?.length) {
      router.replace("/app");
    }
  }, [router, workspaces.data]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await createWorkspace.mutateAsync({
      name,
      logo: logo ?? undefined,
    });
    router.replace("/app");
  }

  return (
    <AuthLayout
      eyebrow="Workspace"
      panelTitle="Give your team a home."
      panelDescription="Create a workspace to keep projects, tasks, and members isolated from other spaces."
    >
      <PendingInvitesBanner />
      <AuthCard>
        <h2 className="text-2xl font-semibold tracking-tight">
          Create your workspace
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You will be the owner. Switch between workspaces anytime from the
          sidebar.
        </p>
        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Corp"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Workspace logo</Label>
            <Input
              id="logo"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setLogoError(null);
                if (!file) {
                  setLogo(null);
                  return;
                }
                void readImageAsDataUrl(file)
                  .then(setLogo)
                  .catch((error: Error) => {
                    setLogo(null);
                    setLogoError(error.message);
                  });
              }}
            />
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : null}
            {logoError ? (
              <p className="text-sm text-destructive">{logoError}</p>
            ) : null}
          </div>
          {createWorkspace.error ? (
            <p className="text-sm text-destructive">
              {createWorkspace.error.message}
            </p>
          ) : null}
          <Button
            className="w-full"
            type="submit"
            disabled={!name.trim() || createWorkspace.isPending}
          >
            {createWorkspace.isPending ? "Creating..." : "Create workspace"}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Signed in as {user.email}
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
