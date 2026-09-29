import { env } from "@/lib/env";
import {
  getAccessToken,
  getCurrentWorkspaceId,
  setAccessToken,
} from "@/lib/session";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  workspaceId?: string | null;
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = fetch(`${env.apiUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }

      const data = (await response.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      return data.accessToken;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function authorizedFetch(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const response = await send(path, options);

  if (response.status === 401 && !options.skipAuth) {
    const token = await refreshAccessToken();
    if (token) {
      return send(path, options);
    }
  }

  return response;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return parseResponse<T>(await authorizedFetch(path, options));
}

async function send(path: string, options: RequestOptions) {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  const workspaceId = options.workspaceId ?? getCurrentWorkspaceId();

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !options.skipAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (workspaceId) {
    headers.set("x-workspace-id", workspaceId);
  }

  return fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? response.statusText);

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
