import { apiRequest } from "@/lib/api-client";
import type { AuthResponse, PublicUser } from "@/features/auth/types";

export function register(input: {
  email: string;
  password: string;
  name: string;
  inviteToken?: string;
}) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
    skipAuth: true,
  });
}

export function login(input: { email: string; password: string }) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
    skipAuth: true,
  });
}

export function refreshSession() {
  return apiRequest<AuthResponse>("/auth/refresh", {
    method: "POST",
    skipAuth: true,
  });
}

export function logout() {
  return apiRequest<{ success: boolean }>("/auth/logout", {
    method: "POST",
    skipAuth: true,
  });
}

export function getCurrentUser() {
  return apiRequest<PublicUser>("/auth/me");
}
