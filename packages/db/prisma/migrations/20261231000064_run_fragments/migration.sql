-- Keyed hashes of what a run read, so a run resumed under a new lease can still check outbound text.
CREATE TABLE "run_fragments" (
    "id" SERIAL NOT NULL,
    "runId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fence" INTEGER NOT NULL,
    "keyId" TEXT NOT NULL,
    "entries" BYTEA NOT NULL,
    "publicWords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_fragments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "run_fragments_runId_id_idx" ON "run_fragments"("runId", "id");

ALTER TABLE "run_fragments" ADD CONSTRAINT "run_fragments_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_fragments" ADD CONSTRAINT "run_fragments_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Set when the first attempt claims the run with a key; a run first claimed by older code stays false.
ALTER TABLE "runs" ADD COLUMN "fragmentRecord" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "run_fragments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "run_fragments_tenant" ON "run_fragments"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "run_fragments_system" ON "run_fragments"
  USING (current_setting('app.rls_bypass', true) = 'on');
