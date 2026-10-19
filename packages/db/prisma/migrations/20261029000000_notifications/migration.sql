-- CreateEnum
CREATE TYPE "NotificationImportance" AS ENUM ('info', 'attention');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "channels" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "routineId" TEXT,
    "runId" TEXT,
    "surface" TEXT NOT NULL,
    "threadId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "importance" "NotificationImportance" NOT NULL DEFAULT 'info',
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "shownAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_endpoints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_spaceId_userId_botId_dedupeKey_createdAt_idx" ON "notifications"("spaceId", "userId", "botId", "dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_spaceId_userId_seenAt_idx" ON "notifications"("spaceId", "userId", "seenAt");

-- CreateIndex
CREATE INDEX "notifications_spaceId_userId_createdAt_idx" ON "notifications"("spaceId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_nextAttemptAt_idx" ON "notification_deliveries"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notificationId_channel_key" ON "notification_deliveries"("notificationId", "channel");

-- CreateIndex
CREATE INDEX "notification_endpoints_channel_address_idx" ON "notification_endpoints"("channel", "address");

-- CreateIndex
CREATE INDEX "notification_endpoints_sessionId_idx" ON "notification_endpoints"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_endpoints_userId_channel_deviceId_key" ON "notification_endpoints"("userId", "channel", "deviceId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_endpoints" ADD CONSTRAINT "notification_endpoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_endpoints" ADD CONSTRAINT "notification_endpoints_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

