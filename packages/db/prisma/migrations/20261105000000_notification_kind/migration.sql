-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "kind" TEXT;

-- CreateIndex
CREATE INDEX "notifications_spaceId_userId_botId_seenAt_idx" ON "notifications"("spaceId", "userId", "botId", "seenAt");
