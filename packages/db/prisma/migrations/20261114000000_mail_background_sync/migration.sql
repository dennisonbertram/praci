-- AlterTable
ALTER TABLE "mail_sync_states"
  ADD COLUMN "syncRequestedAt" TIMESTAMP(3),
  ADD COLUMN "backfill" JSONB,
  ADD COLUMN "watchAddress" TEXT,
  ADD COLUMN "watchExpiresAt" TIMESTAMP(3),
  ADD COLUMN "watchHistoryId" TEXT;

-- CreateIndex
CREATE INDEX "mail_sync_states_watchAddress_idx" ON "mail_sync_states"("watchAddress");

-- Connections that already sync by change cursor never list the window again, so they would keep
-- the old 14 days. Mark the older part of the 90-day window as still to cache.
UPDATE "mail_sync_states"
SET "backfill" = jsonb_build_object(
  'inbox', to_char(timezone('utc', now()) - interval '14 days', 'YYYY-MM-DD'),
  'sent', to_char(timezone('utc', now()) - interval '14 days', 'YYYY-MM-DD'))
WHERE "changeCursor" IS NOT NULL;
