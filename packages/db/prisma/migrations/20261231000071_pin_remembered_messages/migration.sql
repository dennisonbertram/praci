-- Remember is the owner's explicit choice, the same as an edit; earlier saves were left unpinned.
-- Only documents Remember itself wrote: the path is remembered/<message id>.md for a message in the
-- same space, and the first revision came from no run (bot tool writes always carry a run id).
-- Idempotent: rows already pinned are set to true again.
UPDATE "memory_documents" d
SET "pinned" = true
WHERE d."scope" = 'bot'
  AND d."path" LIKE 'remembered/%.md'
  AND EXISTS (
    SELECT 1
    FROM "messages" m
    JOIN "threads" t ON t."id" = m."threadId"
    WHERE t."spaceId" = d."spaceId"
      AND d."path" = 'remembered/' || m."id" || '.md'
  )
  AND EXISTS (
    SELECT 1
    FROM "memory_revisions" r
    WHERE r."documentId" = d."id"
      AND r."revision" = 1
      AND r."sourceRunId" IS NULL
  );
