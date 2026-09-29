"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { MailOpen } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export default function LegacyInvitePage() {
  return (
    <Suspense fallback={<OpeningInvite />}>
      <LegacyInviteRedirect />
    </Suspense>
  );
}

function OpeningInvite() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-xs animate-fade-in">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <MailOpen className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-md font-medium text-foreground">Opening invitation…</p>
          <p className="text-sm text-muted-foreground">
            Hang tight while we take you there.
          </p>
        </div>
        <Spinner className="text-muted-foreground" label="Redirecting" />
      </div>
    </div>
  );
}

function LegacyInviteRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    router.replace(token ? `/invite/${token}` : "/app");
  }, [router, token]);

  return <OpeningInvite />;
}
