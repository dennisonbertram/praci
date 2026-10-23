CREATE TABLE "company_import_evidence" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_import_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_import_evidence_runId_evidenceId_key"
  ON "company_import_evidence"("runId", "evidenceId");
CREATE INDEX "company_import_evidence_spaceId_ownerUserId_evidenceId_idx"
  ON "company_import_evidence"("spaceId", "ownerUserId", "evidenceId");

ALTER TABLE "company_import_evidence"
  ADD CONSTRAINT "company_import_evidence_run_scope_fkey"
  FOREIGN KEY ("runId", "spaceId", "ownerUserId")
  REFERENCES "company_import_runs"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_import_evidence"
  ADD CONSTRAINT "company_import_evidence_evidence_scope_fkey"
  FOREIGN KEY ("evidenceId", "spaceId", "ownerUserId")
  REFERENCES "company_evidence"("id", "spaceId", "ownerUserId")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "company_import_evidence" ("id", "runId", "evidenceId", "spaceId", "ownerUserId")
SELECT gen_random_uuid()::text, run."id", evidence."id", run."spaceId", run."ownerUserId"
FROM "company_evidence" AS evidence
JOIN "company_import_runs" AS run
  ON run."id" = evidence."extractorRunId"
 AND run."spaceId" = evidence."spaceId"
 AND run."ownerUserId" = evidence."ownerUserId";
