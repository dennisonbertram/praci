-- Additive: a new table the previous release never reads or writes.
CREATE TABLE IF NOT EXISTS "approval_decisions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "routineId" TEXT,
    "runId" TEXT,
    "effectId" TEXT,
    "externalActionId" TEXT,
    "tool" TEXT NOT NULL,
    "connectorKind" TEXT,
    "actionType" TEXT,
    "targetKey" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "cleanRun" BOOLEAN NOT NULL,
    "tier" TEXT NOT NULL,
    "argsKeys" TEXT[],
    "argsSize" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "approval_decisions_spaceId_userId_botId_tool_targetKey_createdAt_idx"
    ON "approval_decisions"("spaceId", "userId", "botId", "tool", "targetKey", "createdAt");

ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
