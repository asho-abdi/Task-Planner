# Task Planner and Tracker

Multi-workspace Task Management / AI Work Platform.

This repository currently contains the **project foundation**: NestJS API, Next.js app, Prisma schema for users/workspaces, authentication, and health checks. Domain features are not implemented yet.

## Architecture

```
Browser → Next.js → NestJS API → PostgreSQL
                               → Redis
```

See [docs/architecture.md](docs/architecture.md) for module boundaries, auth, and workspace authorization.

## Prerequisites

- Node.js 20+
- Docker (PostgreSQL + Redis)

## Quick start

```bash
docker compose up -d

cd backend
copy .env.example .env   # Windows
npm install
npx prisma migrate dev
npm run start:dev

cd ../frontend
copy .env.example .env.local
npm install
npm run dev
```

- API: http://localhost:3001/api/v1
- Health: http://localhost:3001/api/v1/health
- Web: http://localhost:3000

## Environment

Backend (`backend/.env.example`):

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `PORT`

Frontend (`frontend/.env.example`):

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

Never commit real secrets. Copy the example files locally and replace placeholder values.

## Scripts

Backend:

- `npm run start:dev` — watch mode
- `npm run build` — compile
- `npx prisma migrate dev` — apply migrations
- `npm run lint` — ESLint

Frontend:

- `npm run dev` — Next.js
- `npm run build` — production build
- `npm run lint` — ESLint
