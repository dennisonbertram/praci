-- Idempotent: a database that applied this under its earlier name already has both objects.
ALTER TABLE "data_room_items" ADD COLUMN IF NOT EXISTS "scannerRunId" TEXT;

CREATE INDEX IF NOT EXISTS "data_room_items_spaceId_userId_source_status_scannerRunId_createdAt_idx"
ON "data_room_items"("spaceId", "userId", "source", "status", "scannerRunId", "createdAt");
