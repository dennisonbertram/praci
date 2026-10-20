-- AlterTable: existing rows are owner-written and active.
ALTER TABLE "agent_skills" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "pendingContent" TEXT;
