-- Additive Phase 2 meetings and calendar fields. Does not drop data.

DO $$ BEGIN
  CREATE TYPE "MeetingMode" AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeetingProvider" AS ENUM ('GOOGLE_MEET', 'ZOOM', 'MICROSOFT_TEAMS', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeetingParticipantKind" AS ENUM ('REQUIRED', 'OPTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeetingResponse" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'MAYBE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeetingRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "meetingProvider" "MeetingProvider";
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "room" TEXT;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "mapUrl" TEXT;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "mode" "MeetingMode";
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "discussion" TEXT;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "decisions" TEXT;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "remindMinutes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "recurrence" "MeetingRecurrence";
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "recurrenceUntil" TIMESTAMP(3);
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "recurrenceWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

UPDATE "meetings"
SET "mode" = CASE WHEN "meetingLink" IS NOT NULL AND btrim("meetingLink") <> '' THEN 'ONLINE'::"MeetingMode" ELSE 'OFFLINE'::"MeetingMode" END
WHERE "mode" IS NULL;

ALTER TABLE "meetings" ALTER COLUMN "mode" SET DEFAULT 'OFFLINE'::"MeetingMode";
ALTER TABLE "meetings" ALTER COLUMN "mode" SET NOT NULL;

UPDATE "meetings" SET "recurrence" = 'NONE'::"MeetingRecurrence" WHERE "recurrence" IS NULL;
ALTER TABLE "meetings" ALTER COLUMN "recurrence" SET DEFAULT 'NONE'::"MeetingRecurrence";
ALTER TABLE "meetings" ALTER COLUMN "recurrence" SET NOT NULL;

UPDATE "meetings"
SET "remindMinutes" = ARRAY[15]::INTEGER[]
WHERE "remindMinutes" IS NULL OR cardinality("remindMinutes") = 0;

CREATE INDEX IF NOT EXISTS "meetings_teamId_idx" ON "meetings"("teamId");

ALTER TABLE "meeting_participants" ADD COLUMN IF NOT EXISTS "kind" "MeetingParticipantKind";
ALTER TABLE "meeting_participants" ADD COLUMN IF NOT EXISTS "response" "MeetingResponse";
ALTER TABLE "meeting_participants" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);

UPDATE "meeting_participants" SET "kind" = 'REQUIRED'::"MeetingParticipantKind" WHERE "kind" IS NULL;
UPDATE "meeting_participants" SET "response" = 'PENDING'::"MeetingResponse" WHERE "response" IS NULL;
ALTER TABLE "meeting_participants" ALTER COLUMN "kind" SET DEFAULT 'REQUIRED'::"MeetingParticipantKind";
ALTER TABLE "meeting_participants" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "meeting_participants" ALTER COLUMN "response" SET DEFAULT 'PENDING'::"MeetingResponse";
ALTER TABLE "meeting_participants" ALTER COLUMN "response" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "meeting_action_items" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assigneeId" TEXT,
  "dueDate" TIMESTAMP(3),
  "done" BOOLEAN NOT NULL DEFAULT false,
  "taskId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_action_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meeting_action_items_taskId_key" ON "meeting_action_items"("taskId");
CREATE INDEX IF NOT EXISTS "meeting_action_items_meetingId_idx" ON "meeting_action_items"("meetingId");
CREATE INDEX IF NOT EXISTS "meeting_action_items_workspaceId_idx" ON "meeting_action_items"("workspaceId");
CREATE INDEX IF NOT EXISTS "meeting_action_items_assigneeId_idx" ON "meeting_action_items"("assigneeId");
CREATE INDEX IF NOT EXISTS "tasks_meetingId_idx" ON "tasks"("meetingId");

DO $$ BEGIN
  ALTER TABLE "meetings"
    ADD CONSTRAINT "meetings_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
