-- Additive Phase 3 communication tables. Does not drop data.

DO $$ BEGIN
  CREATE TYPE "ChatKind" AS ENUM ('CHANNEL', 'DIRECT', 'PROJECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ChatPrivacy" AS ENUM ('PUBLIC', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ActivityType" AS ENUM (
    'TASK_CREATED',
    'TASK_STATUS_CHANGED',
    'TASK_APPROVED',
    'FILE_UPLOADED',
    'MEETING_SCHEDULED',
    'COMMENT_ADDED',
    'MESSAGE_CREATED',
    'CHANNEL_CREATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "chatMessageId" TEXT;
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "workspace_files" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "workspace_files" ADD COLUMN IF NOT EXISTS "pageId" TEXT;
ALTER TABLE "workspace_files" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "workspace_files" ADD COLUMN IF NOT EXISTS "commentId" TEXT;
ALTER TABLE "workspace_files" ADD COLUMN IF NOT EXISTS "messageId" TEXT;

CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "kind" "ChatKind" NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "privacy" "ChatPrivacy" NOT NULL DEFAULT 'PUBLIC',
  "teamId" TEXT,
  "projectId" TEXT,
  "createdById" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_members" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_reactions" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_comment_reactions" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_comment_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "ActivityType" NOT NULL,
  "title" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_workspaceId_kind_name_key"
  ON "chat_conversations"("workspaceId", "kind", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_projectId_key"
  ON "chat_conversations"("projectId");
CREATE INDEX IF NOT EXISTS "chat_conversations_workspaceId_kind_idx"
  ON "chat_conversations"("workspaceId", "kind");
CREATE INDEX IF NOT EXISTS "chat_conversations_teamId_idx"
  ON "chat_conversations"("teamId");

CREATE UNIQUE INDEX IF NOT EXISTS "chat_members_conversationId_userId_key"
  ON "chat_members"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "chat_members_userId_idx" ON "chat_members"("userId");

CREATE INDEX IF NOT EXISTS "chat_messages_conversationId_createdAt_idx"
  ON "chat_messages"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "chat_messages_workspaceId_idx" ON "chat_messages"("workspaceId");
CREATE INDEX IF NOT EXISTS "chat_messages_parentId_idx" ON "chat_messages"("parentId");

CREATE UNIQUE INDEX IF NOT EXISTS "chat_reactions_messageId_userId_emoji_key"
  ON "chat_reactions"("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "chat_reactions_userId_idx" ON "chat_reactions"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "task_comment_reactions_commentId_userId_emoji_key"
  ON "task_comment_reactions"("commentId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "task_comment_reactions_userId_idx" ON "task_comment_reactions"("userId");
CREATE INDEX IF NOT EXISTS "task_comments_parentId_idx" ON "task_comments"("parentId");

CREATE INDEX IF NOT EXISTS "activity_events_workspaceId_createdAt_idx"
  ON "activity_events"("workspaceId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "tasks_chatMessageId_key" ON "tasks"("chatMessageId");
CREATE INDEX IF NOT EXISTS "workspace_files_teamId_idx" ON "workspace_files"("teamId");
CREATE INDEX IF NOT EXISTS "workspace_files_pageId_idx" ON "workspace_files"("pageId");
CREATE INDEX IF NOT EXISTS "workspace_files_conversationId_idx" ON "workspace_files"("conversationId");
CREATE INDEX IF NOT EXISTS "workspace_files_commentId_idx" ON "workspace_files"("commentId");
CREATE INDEX IF NOT EXISTS "workspace_files_messageId_idx" ON "workspace_files"("messageId");

DO $$ BEGIN
  ALTER TABLE "chat_conversations"
    ADD CONSTRAINT "chat_conversations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_conversations"
    ADD CONSTRAINT "chat_conversations_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_conversations"
    ADD CONSTRAINT "chat_conversations_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_members"
    ADD CONSTRAINT "chat_members_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_members"
    ADD CONSTRAINT "chat_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_reactions"
    ADD CONSTRAINT "chat_reactions_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_reactions"
    ADD CONSTRAINT "chat_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "task_comment_reactions"
    ADD CONSTRAINT "task_comment_reactions_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "task_comment_reactions"
    ADD CONSTRAINT "task_comment_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "task_comments"
    ADD CONSTRAINT "task_comments_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "task_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "activity_events"
    ADD CONSTRAINT "activity_events_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "activity_events"
    ADD CONSTRAINT "activity_events_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_chatMessageId_fkey"
    FOREIGN KEY ("chatMessageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_files"
    ADD CONSTRAINT "workspace_files_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_files"
    ADD CONSTRAINT "workspace_files_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "workspace_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_files"
    ADD CONSTRAINT "workspace_files_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_files"
    ADD CONSTRAINT "workspace_files_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "task_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_files"
    ADD CONSTRAINT "workspace_files_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
