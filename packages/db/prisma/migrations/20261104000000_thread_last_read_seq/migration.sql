-- AlterTable
ALTER TABLE "threads" ADD COLUMN "lastReadSeq" INTEGER NOT NULL DEFAULT -1;

-- Existing read threads are read through their newest message. Unread threads keep their
-- newest other-party message unread, so the "New" divider has somewhere to start.
UPDATE "threads" SET "lastReadSeq" = "nextMessageSeq" - 1 WHERE "unread" = false;
UPDATE "threads" t SET "lastReadSeq" = COALESCE(
  (SELECT MAX(m."seq") - 1 FROM "messages" m WHERE m."threadId" = t."id" AND m."role" <> 'user'),
  t."nextMessageSeq" - 1
) WHERE t."unread" = true;
