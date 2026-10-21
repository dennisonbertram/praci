CREATE TABLE "company_refresh_sources" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "connectionId" TEXT,
  "mcpServerId" TEXT,
  "scope" JSONB NOT NULL DEFAULT '{}',
  "tokenCap" BIGINT NOT NULL,
  "capability" TEXT NOT NULL DEFAULT 'pending',
  "status" TEXT NOT NULL DEFAULT 'needs_baseline',
  "reason" TEXT,
  "committedCheckpoint" JSONB,
  "lastSuccessAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "activeRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_refresh_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_refresh_sources_token_cap_check" CHECK ("tokenCap" > 0),
  CONSTRAINT "company_refresh_sources_locator_check"
    CHECK (NOT ("connectionId" IS NOT NULL AND "mcpServerId" IS NOT NULL))
);

CREATE UNIQUE INDEX "company_refresh_sources_id_spaceId_ownerUserId_key"
  ON "company_refresh_sources"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_refresh_sources_spaceId_ownerUserId_sourceKey_key"
  ON "company_refresh_sources"("spaceId", "ownerUserId", "sourceKey");
CREATE INDEX "company_refresh_sources_spaceId_ownerUserId_nextRunAt_idx"
  ON "company_refresh_sources"("spaceId", "ownerUserId", "nextRunAt");
CREATE INDEX "company_refresh_sources_activeRunId_idx"
  ON "company_refresh_sources"("activeRunId");

ALTER TABLE "company_refresh_sources"
  ADD CONSTRAINT "company_refresh_sources_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "company_refresh_sources_owner_fkey"
    FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_import_sources"
  ADD COLUMN "baseCheckpoint" JSONB,
  ADD COLUMN "proposedCheckpoint" JSONB,
  ADD COLUMN "refreshSourceId" TEXT,
  ADD COLUMN "sampled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "company_import_sources_refreshSourceId_idx"
  ON "company_import_sources"("refreshSourceId");

ALTER TABLE "company_import_sources"
  ADD CONSTRAINT "company_import_sources_refreshSourceId_fkey"
    FOREIGN KEY ("refreshSourceId", "spaceId", "ownerUserId")
    REFERENCES "company_refresh_sources"("id", "spaceId", "ownerUserId")
    ON DELETE CASCADE ON UPDATE CASCADE;
