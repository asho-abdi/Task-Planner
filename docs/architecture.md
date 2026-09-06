# Architecture

The platform is a multi-workspace collaboration system. This document describes the **foundation** only. Domain features (tasks, projects, meetings, AI, automations, and so on) are reserved as NestJS modules and will be implemented in later steps.

## Runtime topology

```
Browser
  └── Next.js (App Router UI)
        └── NestJS API  (/api/v1)
              ├── PostgreSQL (Prisma)
              └── Redis (cache, later BullMQ / Socket.IO scale-out)
```

There is **one backend**: NestJS. The Next.js app does not expose a second API. The browser calls NestJS directly with CORS credentials so the httpOnly refresh cookie can be set by the API origin.

## Backend

NestJS modules are domain-based. Controllers stay thin; services own business rules; Prisma is the only database access path.

| Module | Status |
| --- | --- |
| `auth`, `users`, `workspaces` | Implemented (foundation) |
| `health`, `prisma`, `redis`, `config`, `common` | Implemented |
| `teams`, `projects`, `tasks`, `meetings`, `todos` | Scaffold only |
| `notifications`, `reports`, `goals`, `automations`, `ai`, `files` | Scaffold only |

### Request pipeline

Every private HTTP request goes through:

1. **Authentication** — global `JwtAuthGuard` (Bearer access token). Public routes opt out with `@Public()`.
2. **Workspace authorization** — `WorkspaceGuard` on workspace-scoped routes. Membership is loaded from the database. `workspaceId` from params or `x-workspace-id` is never trusted alone.
3. **Role / permission checks** — `RolesGuard` with `@WorkspaceScoped(OWNER, ADMIN, ...)`.

Refresh tokens are JWTs stored in an httpOnly cookie (`refresh_token`, path `/api/v1/auth`). Access tokens are short-lived and returned in the JSON body (kept in frontend memory, not `localStorage`).

### Health

`GET /api/v1/health` checks PostgreSQL (`SELECT 1`) and Redis (`PING`) when Redis is configured. Returns `503` when a required check is down.

## Frontend

Feature folders map to domains (`features/auth`, `features/workspaces`). Shared UI lives in `components/ui` (shadcn/ui). Server state uses TanStack Query (`staleTime: 60s`). UI/workspace selection uses Zustand.

### Progressive create dialogs

Creation UIs such as **New Workspace** (and later New Task / Project / Meeting / Todo) open immediately. The dialog does not wait for network. Async fields render skeletons and hydrate when queries resolve. Cached query data makes those fields ready instantly.

## Database (this step)

UUID primary keys, `createdAt` / `updatedAt`:

- `User`
- `Workspace`
- `WorkspaceMember` (unique `[workspaceId, userId]`, role enum)
