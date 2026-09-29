# Architecture

The platform is a multi-workspace collaboration system. NestJS is the only backend API. The Next.js app is UI only.

## Runtime topology

```
Browser
  └── Next.js (App Router UI)
        └── NestJS API  (/api/v1)
              ├── PostgreSQL (Prisma)
              └── Redis (optional: cache, Socket.IO scale-out, jobs)
```

The browser calls NestJS directly with CORS credentials so the httpOnly refresh cookie can be set by the API origin.

## Backend

NestJS modules are domain-based. Controllers stay thin; services own business rules; Prisma is the only database access path.

| Module | Status |
| --- | --- |
| `auth`, `users`, `workspaces` | Implemented |
| `health`, `prisma`, `redis`, `config`, `common` | Implemented |
| `teams`, `projects`, `tasks`, `meetings`, `todos` | Implemented |
| `notifications`, `reports`, `goals`, `files`, `pages`, `chat` | Implemented |
| `activity`, `ai`, `automations` | Implemented (AI needs a provider key; automations currently notify) |
| `realtime` | Implemented (Socket.IO) |

### Request pipeline

Every private HTTP request goes through:

1. **Authentication** — global `JwtAuthGuard` (Bearer access token). Public routes opt out with `@Public()`.
2. **Workspace authorization** — `WorkspaceGuard` on workspace-scoped routes. Membership is loaded from the database. `workspaceId` from params or `x-workspace-id` is never trusted alone.
3. **Role / permission checks** — `RolesGuard` with `@WorkspaceScoped(OWNER, ADMIN, ...)`.

Refresh tokens are JWTs stored in an httpOnly cookie (`refresh_token`, path `/api/v1/auth`). Access tokens are short-lived and returned in the JSON body (kept in frontend memory, not `localStorage`).

### Health

`GET /api/v1/health` checks PostgreSQL (`SELECT 1`) and Redis (`PING`) when Redis is configured. Returns `503` when a required check is down.

## Frontend

Feature folders map to domains (`features/auth`, `features/workspaces`, `features/tasks`, …). Shared UI lives in `components/ui`. Server state uses TanStack Query. UI/workspace selection uses Zustand.

Creation dialogs open immediately. Async dropdowns hydrate when queries resolve.

## Known issues

See [system-problems.md](./system-problems.md) for the latest audit, fixes, and remaining product limits.
