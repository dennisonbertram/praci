-- Bot-built tools: a skill with one sandboxed script, pinned by the hash the owner approved.
ALTER TABLE "agent_skills" ADD COLUMN "toolSource" TEXT,
ADD COLUMN "toolInputSchema" JSONB,
ADD COLUMN "toolSourceHash" TEXT,
ADD COLUMN "toolNotes" JSONB,
ADD COLUMN "pendingTool" JSONB;
