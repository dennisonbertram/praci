CREATE TABLE "company_import_candidates" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_import_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_import_candidates_runId_candidateId_key"
  ON "company_import_candidates"("runId", "candidateId");
CREATE INDEX "company_import_candidates_spaceId_ownerUserId_candidateId_idx"
  ON "company_import_candidates"("spaceId", "ownerUserId", "candidateId");

ALTER TABLE "company_import_candidates"
  ADD CONSTRAINT "company_import_candidates_run_scope_fkey"
  FOREIGN KEY ("runId", "spaceId", "ownerUserId")
  REFERENCES "company_import_runs"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_candidates"
  ADD CONSTRAINT "company_import_candidates_candidate_scope_fkey"
  FOREIGN KEY ("candidateId", "spaceId", "ownerUserId")
  REFERENCES "company_candidates"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
