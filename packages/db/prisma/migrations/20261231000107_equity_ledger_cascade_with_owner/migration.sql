-- ON DELETE SET NULL (column list) needs PostgreSQL 15 or later. Fail first with a clear message
-- instead of a syntax error on an older server.
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'Migration 20261231000107 needs PostgreSQL 15 or later (server is %)', current_setting('server_version');
  END IF;
END $$;

-- Deleting a space or an account removes its cap table. Migration 76 made these RESTRICT, which
-- blocked account deletion (the personal organization delete cascades to its spaces) and gave the
-- user no way to erase their data. Every equity table already cascades from the ledger.
ALTER TABLE "equity_ledgers" DROP CONSTRAINT "equity_ledgers_spaceId_fkey";
ALTER TABLE "equity_ledgers" ADD CONSTRAINT "equity_ledgers_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equity_ledgers" DROP CONSTRAINT "equity_ledgers_userId_fkey";
ALTER TABLE "equity_ledgers" ADD CONSTRAINT "equity_ledgers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deleting a contact or a Data room document must not be blocked by the cap table, and deleting a
-- space removes contacts and documents in the same statement as the ledger. A deleted contact
-- unlinks its holder (only contactId is cleared; spaceId and userId stay); a deleted document
-- drops its link. Prisma cannot express the column list, so schema.prisma keeps NoAction.
ALTER TABLE "equity_stakeholders" DROP CONSTRAINT "equity_stakeholders_contactId_spaceId_userId_fkey";
ALTER TABLE "equity_stakeholders" ADD CONSTRAINT "equity_stakeholders_contactId_spaceId_userId_fkey"
  FOREIGN KEY ("contactId", "spaceId", "userId") REFERENCES "contacts"("id", "spaceId", "userId")
  ON DELETE SET NULL ("contactId") ON UPDATE CASCADE;
ALTER TABLE "equity_document_links" DROP CONSTRAINT "equity_document_links_dataRoomItemId_spaceId_userId_fkey";
ALTER TABLE "equity_document_links" ADD CONSTRAINT "equity_document_links_dataRoomItemId_spaceId_userId_fkey"
  FOREIGN KEY ("dataRoomItemId", "spaceId", "userId") REFERENCES "data_room_items"("id", "spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
