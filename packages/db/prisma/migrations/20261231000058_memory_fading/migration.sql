-- Memories fade with age and lack of use. Existing rows become facts that have not been used yet;
-- nothing is deleted, and the new columns need no extra row-level security (same rows, same policy).
ALTER TABLE "memory_documents"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'fact',
  ADD COLUMN "useCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3),
  ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
