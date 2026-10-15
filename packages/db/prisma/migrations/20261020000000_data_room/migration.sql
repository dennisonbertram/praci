DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE EXCEPTION 'The database image must include pgvector (the pgvector/pgvector Postgres image). See docs/self-host.md, section Upgrade. After switching the image, run: pnpm --filter @rakazo/db exec prisma migrate resolve --rolled-back 20261020000000_data_room';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "data_room_folders" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_room_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_room_items" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "source" TEXT NOT NULL,
    "sourceConnectionId" TEXT,
    "externalId" TEXT,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "docType" TEXT,
    "docDate" TIMESTAMP(3),
    "parties" TEXT[],
    "amountCents" BIGINT,
    "currency" TEXT,
    "tags" TEXT[],
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_room_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_room_chunks" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED,
    "embedding" vector(1024),
    "embeddingModel" TEXT,
    CONSTRAINT "data_room_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_room_sync_states" (
    "connectionId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "error" TEXT,
    CONSTRAINT "data_room_sync_states_pkey" PRIMARY KEY ("connectionId")
);

CREATE INDEX "data_room_folders_spaceId_parentId_idx" ON "data_room_folders"("spaceId", "parentId");
CREATE INDEX "data_room_items_spaceId_folderId_idx" ON "data_room_items"("spaceId", "folderId");
CREATE INDEX "data_room_items_spaceId_status_idx" ON "data_room_items"("spaceId", "status");
CREATE INDEX "data_room_items_parties_idx" ON "data_room_items" USING GIN ("parties");
CREATE INDEX "data_room_items_tags_idx" ON "data_room_items" USING GIN ("tags");
CREATE UNIQUE INDEX "data_room_chunks_itemId_ordinal_key" ON "data_room_chunks"("itemId", "ordinal");
CREATE INDEX "data_room_chunks_spaceId_userId_idx" ON "data_room_chunks"("spaceId", "userId");
CREATE INDEX "data_room_sync_states_spaceId_idx" ON "data_room_sync_states"("spaceId");

-- Prisma cannot express the indexes below.
-- NULL parent_id must still collide at the root, so the parent is coalesced to ''.
CREATE UNIQUE INDEX "data_room_folders_name_key"
  ON "data_room_folders"("spaceId", "userId", COALESCE("parentId", ''), "name");
CREATE UNIQUE INDEX "data_room_items_upload_sha256_key"
  ON "data_room_items"("spaceId", "userId", "sha256") WHERE "source" = 'upload';
CREATE UNIQUE INDEX "data_room_items_external_key"
  ON "data_room_items"("spaceId", "sourceConnectionId", "externalId") WHERE "externalId" IS NOT NULL;
CREATE INDEX "data_room_chunks_tsv_idx" ON "data_room_chunks" USING GIN ("tsv");
-- ponytail: exact vector scan per owner over the (spaceId, userId) index; add per-space
-- partitioned ANN indexes if latency requires. No shared HNSW: it filters after the index scan.

ALTER TABLE "data_room_folders" ADD CONSTRAINT "data_room_folders_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_room_folders" ADD CONSTRAINT "data_room_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "data_room_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_room_items" ADD CONSTRAINT "data_room_items_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_room_items" ADD CONSTRAINT "data_room_items_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "data_room_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_room_items" ADD CONSTRAINT "data_room_items_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_room_chunks" ADD CONSTRAINT "data_room_chunks_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_room_chunks" ADD CONSTRAINT "data_room_chunks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "data_room_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_room_sync_states" ADD CONSTRAINT "data_room_sync_states_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_room_sync_states" ADD CONSTRAINT "data_room_sync_states_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
