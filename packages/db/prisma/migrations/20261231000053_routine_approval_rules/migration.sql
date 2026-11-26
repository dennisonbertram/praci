-- "Always for this routine": a tool Allow that applies to one routine's runs only.
ALTER TABLE "action_approval_rules" ADD COLUMN "routineId" TEXT;

ALTER TABLE "action_approval_rules"
  ADD CONSTRAINT "action_approval_rules_routineId_fkey"
  FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "action_approval_rules_routineId_idx" ON "action_approval_rules"("routineId");

-- One rule per target, now including the routine.
DROP INDEX "action_approval_rules_target_key";
CREATE UNIQUE INDEX "action_approval_rules_target_key"
  ON "action_approval_rules"("spaceId", "createdByUserId", COALESCE("botId", ''), COALESCE("routineId", ''), "matchKind", lower("matchValue"));
