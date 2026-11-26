-- Prisma cannot express two things in this file, so schema.prisma does not describe them and a
-- later `prisma migrate diff` or `migrate dev` will try to undo them. Do not apply that output
-- blindly. See docs/cap-table/EXTENDING.md ("Migration forms Prisma cannot express").
--   1. the partial unique indexes (document links and pending portal changes), and
--   2. ON DELETE SET NULL ("contactId") (column-list form, PostgreSQL 15+; the repo runs 16).
-- One link per document and target. A document link points at exactly one of three targets, and a
-- unique index treats NULLs as distinct, so each target column gets its own partial index.
DELETE FROM "equity_document_links" a USING "equity_document_links" b
WHERE a."id" > b."id" AND a."spaceId" = b."spaceId" AND a."userId" = b."userId"
  AND a."dataRoomItemId" = b."dataRoomItemId"
  AND a."stakeholderId" IS NOT DISTINCT FROM b."stakeholderId"
  AND a."certificateId" IS NOT DISTINCT FROM b."certificateId"
  AND a."roundId" IS NOT DISTINCT FROM b."roundId";

CREATE UNIQUE INDEX "equity_document_links_stakeholder_key"
  ON "equity_document_links"("spaceId", "userId", "dataRoomItemId", "stakeholderId")
  WHERE "stakeholderId" IS NOT NULL;
CREATE UNIQUE INDEX "equity_document_links_certificate_key"
  ON "equity_document_links"("spaceId", "userId", "dataRoomItemId", "certificateId")
  WHERE "certificateId" IS NOT NULL;
CREATE UNIQUE INDEX "equity_document_links_round_key"
  ON "equity_document_links"("spaceId", "userId", "dataRoomItemId", "roundId")
  WHERE "roundId" IS NOT NULL;

-- Deleting a Data room document drops its links; deleting an investor contact unlinks the holder.
ALTER TABLE "equity_document_links" DROP CONSTRAINT "equity_document_links_dataRoomItemId_spaceId_userId_fkey";
ALTER TABLE "equity_document_links" ADD CONSTRAINT "equity_document_links_dataRoomItemId_spaceId_userId_fkey"
  FOREIGN KEY ("dataRoomItemId", "spaceId", "userId")
  REFERENCES "data_room_items"("id", "spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equity_stakeholders" DROP CONSTRAINT "equity_stakeholders_contactId_spaceId_userId_fkey";
ALTER TABLE "equity_stakeholders" ADD CONSTRAINT "equity_stakeholders_contactId_spaceId_userId_fkey"
  FOREIGN KEY ("contactId", "spaceId", "userId")
  REFERENCES "contacts"("id", "spaceId", "userId")
  ON DELETE SET NULL ("contactId") ON UPDATE CASCADE;

-- One pending portal profile change per holder (a new proposal supersedes the old one). Older
-- duplicates are rejected first so the index can be built.
UPDATE "equity_stakeholder_changes" a SET "status" = 'rejected', "resolvedAt" = now()
WHERE a."kind" = 'profile' AND a."source" = 'portal' AND a."status" = 'pending'
  AND EXISTS (
    SELECT 1 FROM "equity_stakeholder_changes" b
    WHERE b."kind" = 'profile' AND b."source" = 'portal' AND b."status" = 'pending'
      AND b."spaceId" = a."spaceId" AND b."userId" = a."userId"
      AND b."stakeholderId" = a."stakeholderId"
      AND (b."createdAt", b."id") > (a."createdAt", a."id")
  );
CREATE UNIQUE INDEX "equity_stakeholder_changes_portal_pending_key"
  ON "equity_stakeholder_changes"("spaceId", "userId", "stakeholderId")
  WHERE "kind" = 'profile' AND "source" = 'portal' AND "status" = 'pending';
