"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useBootstrapSession } from "@/features/auth/hooks";
import { setAccessToken } from "@/lib/session";

export function useRequireAuth() {
  const router = useRouter();
  const bootstrap = useBootstrapSession();

  useEffect(() => {
    if (bootstrap.isError) {
      setAccessToken(null);
      router.replace("/login");
    }
  }, [bootstrap.isError, router]);

  return {
    user: bootstrap.data ?? null,
    isLoading: bootstrap.isLoading,
  };
}
