-- Idempotent: a database that applied this under its earlier name already has the index.
CREATE UNIQUE INDEX IF NOT EXISTS "data_room_items_scan_sha256_key"
  ON "data_room_items"("spaceId", "userId", "sha256") WHERE "source" = 'scan';
