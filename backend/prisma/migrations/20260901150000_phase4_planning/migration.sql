-- Additive Phase 4 planning tables. Does not drop data.

ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

UPDATE "milestones" m
SET "workspaceId" = g."workspaceId"
FROM "goals" g
WHERE m."goalId" = g."id"
  AND (m."workspaceId" IS NULL OR m."workspaceId" = '');

-- Orphan rows (should not exist) stay out of NOT NULL until filled.
UPDATE "milestones"
SET "workspaceId" = (SELECT "id" FROM "workspaces" LIMIT 1)
WHERE "workspaceId" IS NULL;

ALTER TABLE "milestones" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "milestones" ALTER COLUMN "goalId" DROP NOT NULL;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "milestoneId" TEXT;

CREATE TABLE IF NOT EXISTS "goal_tasks" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  CONSTRAINT "goal_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_templates" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "goal_tasks_goalId_taskId_key" ON "goal_tasks"("goalId", "taskId");
CREATE INDEX IF NOT EXISTS "goal_tasks_taskId_idx" ON "goal_tasks"("taskId");
CREATE INDEX IF NOT EXISTS "project_templates_workspaceId_idx" ON "project_templates"("workspaceId");
CREATE INDEX IF NOT EXISTS "milestones_workspaceId_idx" ON "milestones"("workspaceId");
CREATE INDEX IF NOT EXISTS "milestones_projectId_idx" ON "milestones"("projectId");
CREATE INDEX IF NOT EXISTS "tasks_milestoneId_idx" ON "tasks"("milestoneId");

DO $$ BEGIN
  ALTER TABLE "milestones"
    ADD CONSTRAINT "milestones_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "milestones"
    ADD CONSTRAINT "milestones_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "goal_tasks"
    ADD CONSTRAINT "goal_tasks_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "goal_tasks"
    ADD CONSTRAINT "goal_tasks_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "project_templates"
    ADD CONSTRAINT "project_templates_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "project_templates"
    ADD CONSTRAINT "project_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
