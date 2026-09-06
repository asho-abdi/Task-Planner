"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

export default function LegacyInvitePage() {
  return (
    <Suspense>
      <LegacyInviteRedirect />
    </Suspense>
  );
}

function LegacyInviteRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    router.replace(token ? `/invite/${token}` : "/app");
  }, [router, token]);

  return (
    <p className="text-sm text-muted-foreground">Opening invitation…</p>
  );
}
