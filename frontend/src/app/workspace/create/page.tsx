"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Building2 } from "lucide-react";
import { AuthCard, AuthLayout } from "@/components/auth/auth-layout";
import { AppLoadingScreen } from "@/components/layout/app-loading";
import { ErrorState } from "@/components/ui/empty-state";
import { WorkspaceMark } from "@/features/workspaces/workspace-switcher";
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
    return <AppLoadingScreen label="Loading…" />;
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
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Building2 className="size-5" />
        </span>
        <h1 className="mt-4 font-heading text-2xl font-semibold tracking-[-0.02em]">
          Create your workspace
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground">
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
            <Label htmlFor="logo">
              Workspace logo <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="flex items-center gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <WorkspaceMark name={name || "W"} className="size-10 rounded-lg text-base" />
              )}
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
            </div>
            {logoError ? (
              <p role="alert" className="text-sm text-danger-soft-foreground">{logoError}</p>
            ) : null}
          </div>
          {createWorkspace.error ? (
            <ErrorState title="Couldn't create the workspace" description={createWorkspace.error.message} />
          ) : null}
          <Button
            className="w-full"
            type="submit"
            size="lg"
            disabled={!name.trim()}
            loading={createWorkspace.isPending}
          >
            Create workspace
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Signed in as {user.email}
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
