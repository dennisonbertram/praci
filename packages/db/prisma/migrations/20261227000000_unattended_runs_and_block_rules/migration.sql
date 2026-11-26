-- Run mode, stored on the run: true when nobody is watching (see newRunUnattended in core).
-- Runs already in the table are backfilled by trigger. A paused run is requeued on the same row
-- and keeps this value, so the backfill matters: the owner's live triggers are attended, every
-- other trigger (routine, webhook, messaging, ...) is unattended. The column default stays true
-- so a creation path that forgets to set it fails closed.
ALTER TABLE "runs" ADD COLUMN "unattended" BOOLEAN NOT NULL DEFAULT true;
UPDATE "runs" SET "unattended" = false
  WHERE "trigger" IN ('user', 'follow_up', 'reaction', 'call_end', 'skill');

-- The prompt carries outside content. Never cleared by approving a card. Existing runs: false.
ALTER TABLE "runs" ADD COLUMN "externalTaint" BOOLEAN NOT NULL DEFAULT false;

-- Per-bot approval rules. Null botId keeps existing rows space-wide.
ALTER TABLE "action_approval_rules" ADD COLUMN "botId" TEXT;
ALTER TABLE "action_approval_rules"
  ADD CONSTRAINT "action_approval_rules_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "action_approval_rules_botId_idx" ON "action_approval_rules"("botId");

-- One rule per target, whatever its effect. Before the old unique index (which allowed an
-- always_allow and a require_approval row for the same target) is replaced, collapse such pairs:
-- keep require_approval over always_allow (fail closed), and the oldest row if still tied.
DROP INDEX IF EXISTS "action_approval_rules_spaceId_createdByUserId_effect_matchK_key";
DELETE FROM "action_approval_rules" r
  USING "action_approval_rules" k
  WHERE r."id" <> k."id"
    AND r."spaceId" = k."spaceId"
    AND r."createdByUserId" = k."createdByUserId"
    AND r."matchKind" = k."matchKind"
    AND lower(r."matchValue") = lower(k."matchValue")
    AND COALESCE(r."botId", '') = COALESCE(k."botId", '')
    AND (
      (CASE r."effect" WHEN 'require_approval' THEN 0 WHEN 'always_allow' THEN 1 ELSE 2 END,
       r."createdAt", r."id")
      >
      (CASE k."effect" WHEN 'require_approval' THEN 0 WHEN 'always_allow' THEN 1 ELSE 2 END,
       k."createdAt", k."id")
    );
CREATE UNIQUE INDEX "action_approval_rules_target_key"
  ON "action_approval_rules"("spaceId", "createdByUserId", COALESCE("botId", ''), "matchKind", lower("matchValue"));
