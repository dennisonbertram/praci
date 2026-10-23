DROP INDEX IF EXISTS "company_import_calls_callId_key";
ALTER TABLE "company_evidence"
  DROP CONSTRAINT IF EXISTS "company_evidence_import_run_scope_fkey";
