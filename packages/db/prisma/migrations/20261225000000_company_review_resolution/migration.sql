ALTER TABLE "company_evidence"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT;

ALTER TABLE "company_import_runs"
  ADD COLUMN "notificationStates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "notificationPendingStates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "company_import_sources"
  ADD COLUMN "baseCheckpointGeneration" INTEGER;

ALTER TABLE "company_refresh_sources"
  ADD COLUMN "checkpointGeneration" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "company_candidate_resolutions" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "factKind" TEXT,
  "factId" TEXT,
  "claimKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_candidate_resolutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_candidate_resolutions_spaceId_ownerUserId_sourceKey_reason_key"
  ON "company_candidate_resolutions"("spaceId", "ownerUserId", "sourceKey", "reason");
CREATE INDEX "company_candidate_resolutions_spaceId_ownerUserId_factKind_factId_idx"
  ON "company_candidate_resolutions"("spaceId", "ownerUserId", "factKind", "factId");
CREATE INDEX "company_candidate_resolutions_spaceId_ownerUserId_claimKey_idx"
  ON "company_candidate_resolutions"("spaceId", "ownerUserId", "claimKey");

ALTER TABLE "company_candidate_resolutions"
  ADD CONSTRAINT "company_candidate_resolutions_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "company_candidate_resolutions_owner_fkey"
    FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId")
    ON DELETE CASCADE ON UPDATE CASCADE;
