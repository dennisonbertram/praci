-- What the owner asked a bot to keep working toward in its own thread. Runs that work toward it carry its id.

CREATE TABLE "thread_goals" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stopReason" TEXT,
    "continuations" INTEGER NOT NULL DEFAULT 0,
    "stalls" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedRunId" TEXT,
    "lastVerdict" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thread_goals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "runs" ADD COLUMN "goalId" TEXT;

CREATE INDEX "thread_goals_threadId_status_idx" ON "thread_goals"("threadId", "status");
-- One open goal per thread.
CREATE UNIQUE INDEX "thread_goals_one_open_key" ON "thread_goals"("threadId") WHERE "status" IN ('active', 'paused');
CREATE INDEX "runs_goalId_idx" ON "runs"("goalId");

ALTER TABLE "thread_goals" ADD CONSTRAINT "thread_goals_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "thread_goals" ADD CONSTRAINT "thread_goals_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "thread_goals" ADD CONSTRAINT "thread_goals_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runs" ADD CONSTRAINT "runs_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "thread_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security, as for the pipeline tables.
ALTER TABLE "thread_goals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_goals_tenant" ON "thread_goals"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "thread_goals_system" ON "thread_goals"
  USING (current_setting('app.rls_bypass', true) = 'on');
