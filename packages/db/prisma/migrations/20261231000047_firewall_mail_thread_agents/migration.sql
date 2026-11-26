-- Email thread agents start with Firewall on; turn it on for the ones that already exist. A
-- replaced (archived) one has lost its spawn key, so it is found by the email thread that is the
-- first message of its chat.
UPDATE "bots" SET "firewall" = true
WHERE "firewall" = false
  AND (
    "spawnKey" LIKE 'mail-thread:%'
    OR EXISTS (
      SELECT 1 FROM "threads" t JOIN "messages" m ON m."threadId" = t."id"
      WHERE t."botId" = "bots"."id" AND m."seq" = (SELECT MIN(m2."seq") FROM "messages" m2 WHERE m2."threadId" = t."id")
        AND m."role" = 'system' AND m."blocks" @> '[{"kind":"mail_thread"}]'::jsonb
    )
  );
