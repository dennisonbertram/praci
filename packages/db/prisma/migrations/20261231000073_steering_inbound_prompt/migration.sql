-- An inbound delivery shows a short label in the chat but the model needs the full fenced
-- payload, which steering can only carry in its own text. A queued delivery also remembers the
-- routine it belongs to so the continuation run can be attributed to it.
ALTER TABLE "steering_messages" ADD COLUMN "prompt" TEXT;
ALTER TABLE "steering_messages" ADD COLUMN "routineId" TEXT;
-- A continuation run resumes what waited, so it must keep the mode those deliveries imply. Without
-- them an outside payload would be answered as an attended follow-up.
ALTER TABLE "steering_messages" ADD COLUMN "unattended" BOOLEAN;
ALTER TABLE "steering_messages" ADD COLUMN "externalTaint" BOOLEAN;
-- Deliveries queued before the mode was stored are still pending and still carry outside content.
-- Mark them so the run that answers them is tainted, whether a live run claims them or their own
-- continuation starts.
UPDATE "steering_messages" AS s
SET "externalTaint" = true, "unattended" = true
FROM "messages" AS m
WHERE m."id" = s."messageId"
  AND s."claimedAt" IS NULL
  AND s."runId" IS NULL
  AND (s."prompt" LIKE '%<untrusted_delivery_payload%' OR m."blocks"::text LIKE '%<untrusted_delivery_payload%');
