ALTER TABLE "equity_draft_sets"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "issuedIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "equity_draft_sets_revision_check" CHECK ("revision" > 0);
