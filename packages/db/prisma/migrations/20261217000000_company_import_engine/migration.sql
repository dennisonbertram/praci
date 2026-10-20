CREATE TABLE "company_import_runs" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "tokenCap" BIGINT NOT NULL,
  "reservedTokens" BIGINT NOT NULL DEFAULT 0,
  "inputTokensUsed" BIGINT NOT NULL DEFAULT 0,
  "outputTokensUsed" BIGINT NOT NULL DEFAULT 0,
  "disclosureVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_import_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_import_runs_token_cap_check" CHECK ("tokenCap" > 0),
  CONSTRAINT "company_import_runs_reserved_tokens_check" CHECK ("reservedTokens" >= 0),
  CONSTRAINT "company_import_runs_input_tokens_check" CHECK ("inputTokensUsed" >= 0),
  CONSTRAINT "company_import_runs_output_tokens_check" CHECK ("outputTokensUsed" >= 0)
);

CREATE TABLE "company_import_sources" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "connectionId" TEXT,
  "scope" JSONB NOT NULL DEFAULT '{}',
  "cursor" JSONB,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "concurrency" INTEGER NOT NULL DEFAULT 1,
  "tokensReserved" BIGINT NOT NULL DEFAULT 0,
  "inputTokensUsed" BIGINT NOT NULL DEFAULT 0,
  "outputTokensUsed" BIGINT NOT NULL DEFAULT 0,
  "backoffUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_import_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_import_sources_concurrency_check" CHECK ("concurrency" > 0),
  CONSTRAINT "company_import_sources_tokens_check" CHECK (
    "tokensReserved" >= 0 AND "inputTokensUsed" >= 0 AND "outputTokensUsed" >= 0
  )
);

CREATE TABLE "company_import_units" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "unitKey" TEXT NOT NULL,
  "cursor" JSONB,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimToken" TEXT,
  "claimExpiresAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "itemsDiscovered" INTEGER NOT NULL DEFAULT 0,
  "itemsRead" INTEGER NOT NULL DEFAULT 0,
  "factsFound" INTEGER NOT NULL DEFAULT 0,
  "tokensReserved" BIGINT NOT NULL DEFAULT 0,
  "inputTokensUsed" BIGINT NOT NULL DEFAULT 0,
  "outputTokensUsed" BIGINT NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_import_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_import_units_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "company_import_units_counts_check" CHECK (
    "itemsDiscovered" >= 0 AND "itemsRead" >= 0 AND "factsFound" >= 0
    AND "tokensReserved" >= 0 AND "inputTokensUsed" >= 0 AND "outputTokensUsed" >= 0
  )
);

CREATE TABLE "company_import_calls" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "claimToken" TEXT NOT NULL,
  "reservedInput" BIGINT NOT NULL,
  "reservedOutput" BIGINT NOT NULL,
  "recipientKey" TEXT NOT NULL,
  "disclosureVersion" TEXT NOT NULL,
  "actualInput" INTEGER,
  "actualOutput" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "provider" TEXT,
  "model" TEXT,
  "callId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  CONSTRAINT "company_import_calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_import_calls_reservation_id_check" CHECK (
    "reservedInput" >= 0 AND "reservedOutput" >= 0
    AND ("actualInput" IS NULL OR "actualInput" >= 0)
    AND ("actualOutput" IS NULL OR "actualOutput" >= 0)
  )
);

CREATE UNIQUE INDEX "company_import_runs_id_spaceId_ownerUserId_key"
  ON "company_import_runs"("id", "spaceId", "ownerUserId");
CREATE INDEX "company_import_runs_spaceId_ownerUserId_createdAt_idx"
  ON "company_import_runs"("spaceId", "ownerUserId", "createdAt");
CREATE INDEX "company_import_runs_status_updatedAt_idx"
  ON "company_import_runs"("status", "updatedAt");
CREATE UNIQUE INDEX "company_import_sources_id_spaceId_ownerUserId_key"
  ON "company_import_sources"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_import_sources_runId_sourceKey_key"
  ON "company_import_sources"("runId", "sourceKey");
CREATE INDEX "company_import_sources_spaceId_ownerUserId_runId_status_idx"
  ON "company_import_sources"("spaceId", "ownerUserId", "runId", "status");
CREATE UNIQUE INDEX "company_import_units_id_spaceId_ownerUserId_key"
  ON "company_import_units"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_import_units_sourceId_unitKey_key"
  ON "company_import_units"("sourceId", "unitKey");
CREATE INDEX "company_import_units_spaceId_ownerUserId_runId_status_availableAt_idx"
  ON "company_import_units"("spaceId", "ownerUserId", "runId", "status", "availableAt");
CREATE INDEX "company_import_units_sourceId_status_claimExpiresAt_availableAt_idx"
  ON "company_import_units"("sourceId", "status", "claimExpiresAt", "availableAt");
CREATE UNIQUE INDEX "company_import_calls_reservationId_key"
  ON "company_import_calls"("reservationId");
CREATE UNIQUE INDEX "company_import_calls_callId_key"
  ON "company_import_calls"("callId");
CREATE INDEX "company_import_calls_spaceId_ownerUserId_runId_status_idx"
  ON "company_import_calls"("spaceId", "ownerUserId", "runId", "status");
ALTER TABLE "company_candidates" ADD COLUMN "importRunId" TEXT;
CREATE INDEX "company_candidates_spaceId_ownerUserId_importRunId_idx"
  ON "company_candidates"("spaceId", "ownerUserId", "importRunId");

ALTER TABLE "company_import_runs" ADD CONSTRAINT "company_import_runs_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_runs" ADD CONSTRAINT "company_import_runs_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_sources" ADD CONSTRAINT "company_import_sources_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_sources" ADD CONSTRAINT "company_import_sources_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_sources" ADD CONSTRAINT "company_import_sources_run_scope_fkey"
  FOREIGN KEY ("runId", "spaceId", "ownerUserId")
  REFERENCES "company_import_runs"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_units" ADD CONSTRAINT "company_import_units_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_units" ADD CONSTRAINT "company_import_units_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_units" ADD CONSTRAINT "company_import_units_run_scope_fkey"
  FOREIGN KEY ("runId", "spaceId", "ownerUserId")
  REFERENCES "company_import_runs"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_units" ADD CONSTRAINT "company_import_units_source_scope_fkey"
  FOREIGN KEY ("sourceId", "spaceId", "ownerUserId")
  REFERENCES "company_import_sources"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_calls" ADD CONSTRAINT "company_import_calls_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_calls" ADD CONSTRAINT "company_import_calls_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_calls" ADD CONSTRAINT "company_import_calls_run_scope_fkey"
  FOREIGN KEY ("runId", "spaceId", "ownerUserId")
  REFERENCES "company_import_runs"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_calls" ADD CONSTRAINT "company_import_calls_source_scope_fkey"
  FOREIGN KEY ("sourceId", "spaceId", "ownerUserId")
  REFERENCES "company_import_sources"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_calls" ADD CONSTRAINT "company_import_calls_unit_scope_fkey"
  FOREIGN KEY ("unitId", "spaceId", "ownerUserId")
  REFERENCES "company_import_units"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_candidates" ADD CONSTRAINT "company_candidates_import_run_scope_fkey"
  FOREIGN KEY ("importRunId", "spaceId", "ownerUserId")
  REFERENCES "company_import_runs"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
