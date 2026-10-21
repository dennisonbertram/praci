ALTER TABLE "company_import_runs"
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'full';

ALTER TABLE "company_import_sources"
  ADD COLUMN "plan" JSONB NOT NULL DEFAULT '{}';
