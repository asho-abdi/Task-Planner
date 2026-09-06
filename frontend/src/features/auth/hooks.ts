"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import * as authApi from "@/features/auth/api";
import { getAccessToken, setAccessToken } from "@/lib/session";
import type { AuthResponse, PublicUser } from "@/features/auth/types";
import { safeNextPath } from "@/lib/safe-next";

export const authKeys = {
  me: ["auth", "me"] as const,
};

function applySession(data: AuthResponse) {
  setAccessToken(data.accessToken);
}

export function useCurrentUser(enabled = true) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.getCurrentUser,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      applySession(data);
      queryClient.setQueryData(authKeys.me, data.user);
      router.push(next ?? "/app");
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      applySession(data);
      queryClient.setQueryData(authKeys.me, data.user);
      router.push(next ?? "/workspace/create");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setAccessToken(null);
      queryClient.clear();
      router.push("/login");
    },
  });
}

export function useBootstrapSession() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["auth", "bootstrap"],
    queryFn: async () => {
      const cachedUser = queryClient.getQueryData<PublicUser>(authKeys.me);
      if (getAccessToken() && cachedUser) {
        return cachedUser;
      }
      const data = await authApi.refreshSession();
      applySession(data);
      queryClient.setQueryData(authKeys.me, data.user);
      return data.user;
    },
    staleTime: Infinity,
    retry: false,
  });
}
