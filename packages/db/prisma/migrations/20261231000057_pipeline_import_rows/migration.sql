-- One row per firm of a list import: staged, then applied one at a time, so a retry, a restart or a
-- second worker can never apply a row twice, and a failed row is reported on its own. Safe on a
-- database that already holds imports of the old shape, including several open for one user.

CREATE UNIQUE INDEX "pipeline_imports_id_spaceId_userId_key" ON "pipeline_imports"("id", "spaceId", "userId");

CREATE TABLE "pipeline_import_rows" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "normalizedFirm" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'staged',
    "plan" JSONB,
    "outcome" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pipeline_import_rows_importId_normalizedFirm_key" ON "pipeline_import_rows"("importId", "normalizedFirm");
CREATE UNIQUE INDEX "pipeline_import_rows_importId_position_key" ON "pipeline_import_rows"("importId", "position");
CREATE INDEX "pipeline_import_rows_importId_state_position_idx" ON "pipeline_import_rows"("importId", "state", "position");

ALTER TABLE "pipeline_import_rows" ADD CONSTRAINT "pipeline_import_rows_importId_spaceId_userId_fkey"
  FOREIGN KEY ("importId", "spaceId", "userId") REFERENCES "pipeline_imports"("id", "spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rows staged under the old column keep their contents, duplicates included, on their import. A row
-- of that shape may not be a valid list row, so none of them is applied.
INSERT INTO "pipeline_import_rows" ("id", "spaceId", "userId", "importId", "position", "normalizedFirm", "data", "updatedAt")
SELECT i."id" || ':' || r.ord, i."spaceId", i."userId", i."id", (r.ord - 1)::integer, 'legacy:' || r.ord, r.value, CURRENT_TIMESTAMP
FROM "pipeline_imports" i
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(i."rows") = 'array' THEN i."rows" ELSE '[]'::jsonb END
) WITH ORDINALITY AS r(value, ord);

-- An unfinished import of the old shape has no effect for a card to answer, and a user could hold
-- several. Each closes: nothing was approved, so nothing is applied, and the agent stages the list again.
UPDATE "pipeline_imports" SET "status" = 'discarded', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" NOT IN ('done', 'discarded');

ALTER TABLE "pipeline_imports" DROP COLUMN "rows";
-- A message id, never an effect id, so it does not carry over as one.
ALTER TABLE "pipeline_imports" DROP COLUMN "cardMessageId";
ALTER TABLE "pipeline_imports" ADD COLUMN "effectId" TEXT;
ALTER TABLE "pipeline_imports" ADD COLUMN "runId" TEXT;
ALTER TABLE "pipeline_imports" ADD COLUMN "botId" TEXT;
ALTER TABLE "pipeline_imports" ADD COLUMN "created" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "pipeline_imports" ADD COLUMN "result" JSONB;

-- One open import per user, so stage calls and retries cannot start a second one.
CREATE UNIQUE INDEX "pipeline_imports_one_open_key" ON "pipeline_imports"("spaceId", "userId", "pipeline")
  WHERE "status" IN ('staging', 'reviewing');
CREATE INDEX "pipeline_imports_status_updatedAt_idx" ON "pipeline_imports"("status", "updatedAt");

-- Row-level security, as for the other pipeline tables.
ALTER TABLE "pipeline_import_rows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_import_rows_tenant" ON "pipeline_import_rows"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "pipeline_import_rows_system" ON "pipeline_import_rows"
  USING (current_setting('app.rls_bypass', true) = 'on');
