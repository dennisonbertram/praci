-- AlterTable
ALTER TABLE "mail_sync_states"
  ADD COLUMN "syncRequestedAt" TIMESTAMP(3),
  ADD COLUMN "backfill" JSONB,
  ADD COLUMN "watchAddress" TEXT,
  ADD COLUMN "watchExpiresAt" TIMESTAMP(3),
  ADD COLUMN "watchHistoryId" TEXT;

-- CreateIndex
CREATE INDEX "mail_sync_states_watchAddress_idx" ON "mail_sync_states"("watchAddress");
