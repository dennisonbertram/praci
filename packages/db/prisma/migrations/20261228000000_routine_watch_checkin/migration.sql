ALTER TABLE "routines"
  ADD COLUMN "quiet" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "watch" JSONB,
  ADD COLUMN "managedKind" TEXT;

-- One managed check-in routine per bot.
CREATE UNIQUE INDEX "routines_botId_managedKind_key"
  ON "routines" ("botId", "managedKind") WHERE "managedKind" IS NOT NULL;

ALTER TABLE "scratchpad_items"
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "waitingOn" TEXT,
  ADD COLUMN "resolvedReason" TEXT;

CREATE INDEX "scratchpad_items_spaceId_botId_status_dueAt_idx"
  ON "scratchpad_items" ("spaceId", "botId", "status", "dueAt");

CREATE TABLE "routine_watch_states" (
  "routineId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "fingerprint" TEXT,
  "snapshot" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "lastChangedAt" TIMESTAMP(3),
  "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
  "nextCheckAt" TIMESTAMP(3),
  "pausedReason" TEXT,
  "wakesToday" INTEGER NOT NULL DEFAULT 0,
  "wakesDay" TEXT,
  "pendingChange" BOOLEAN NOT NULL DEFAULT false,
  "recentChanges" INTEGER[],
  CONSTRAINT "routine_watch_states_pkey" PRIMARY KEY ("routineId")
);

CREATE INDEX "routine_watch_states_nextCheckAt_idx" ON "routine_watch_states" ("nextCheckAt");
CREATE INDEX "routine_watch_states_spaceId_idx" ON "routine_watch_states" ("spaceId");

ALTER TABLE "routine_watch_states"
  ADD CONSTRAINT "routine_watch_states_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "routine_watch_states_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
