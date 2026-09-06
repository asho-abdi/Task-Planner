-- Additive Phase 1 collaboration fields. Does not drop data.

ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_SHARED';

DO $$ BEGIN
  CREATE TYPE "TeamMemberRole" AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectMemberRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskParticipantRole" AS ENUM ('ASSIGNEE', 'COLLABORATOR', 'WATCHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskSharePermission" AS ENUM ('VIEW', 'COMMENT', 'EDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskVisibility" AS ENUM ('PRIVATE', 'PROJECT', 'WORKSPACE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "workspaces"
SET "slug" = lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'))
  || '-' || substr(replace("id"::text, '-', ''), 1, 8)
WHERE "slug" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_key" ON "workspaces"("slug");

ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "icon" TEXT;

ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "role" "TeamMemberRole";
UPDATE "team_members" SET "role" = 'MEMBER' WHERE "role" IS NULL;
ALTER TABLE "team_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "team_members" ALTER COLUMN "role" SET NOT NULL;

UPDATE "team_members" AS tm
SET "role" = 'ADMIN'
FROM "teams" AS t
WHERE tm."teamId" = t."id" AND tm."userId" = t."ownerId";

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "projects" ALTER COLUMN "teamId" DROP NOT NULL;

ALTER TABLE "project_assignments" ADD COLUMN IF NOT EXISTS "role" "ProjectMemberRole";
UPDATE "project_assignments" SET "role" = 'MEMBER' WHERE "role" IS NULL;
ALTER TABLE "project_assignments" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "project_assignments" ALTER COLUMN "role" SET NOT NULL;

UPDATE "project_assignments" AS pa
SET "role" = 'OWNER'
FROM "projects" AS p
WHERE pa."projectId" = p."id" AND pa."assigneeId" = p."ownerId";

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "visibility" "TaskVisibility";
UPDATE "tasks" SET "visibility" = 'WORKSPACE' WHERE "visibility" IS NULL;
ALTER TABLE "tasks" ALTER COLUMN "visibility" SET DEFAULT 'WORKSPACE';
ALTER TABLE "tasks" ALTER COLUMN "visibility" SET NOT NULL;

ALTER TABLE "task_assignees" ADD COLUMN IF NOT EXISTS "role" "TaskParticipantRole";
UPDATE "task_assignees" SET "role" = 'ASSIGNEE' WHERE "role" IS NULL;
ALTER TABLE "task_assignees" ALTER COLUMN "role" SET DEFAULT 'ASSIGNEE';
ALTER TABLE "task_assignees" ALTER COLUMN "role" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "task_shares" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" "TaskSharePermission" NOT NULL DEFAULT 'VIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_shares_taskId_userId_key" ON "task_shares"("taskId", "userId");
CREATE INDEX IF NOT EXISTS "task_shares_workspaceId_idx" ON "task_shares"("workspaceId");
CREATE INDEX IF NOT EXISTS "task_shares_taskId_idx" ON "task_shares"("taskId");

DO $$ BEGIN
  ALTER TABLE "task_shares"
    ADD CONSTRAINT "task_shares_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "task_shares"
    ADD CONSTRAINT "task_shares_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "task_shares"
    ADD CONSTRAINT "task_shares_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
