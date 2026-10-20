-- AlterTable
ALTER TABLE "mail_messages" ADD COLUMN     "notSpamAt" TIMESTAMP(3),
ADD COLUMN     "skipAppliedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mail_sender_decisions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "skipInboxAt" TIMESTAMP(3),
    "unsubscribeStatus" TEXT,
    "unsubscribeMethod" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_sender_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_action_logs" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "senderAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "threadIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "mail_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_sender_decisions_spaceId_userId_idx" ON "mail_sender_decisions"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_sender_decisions_connectionId_senderAddress_key" ON "mail_sender_decisions"("connectionId", "senderAddress");

-- CreateIndex
CREATE INDEX "mail_action_logs_spaceId_userId_createdAt_idx" ON "mail_action_logs"("spaceId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mail_action_logs_connectionId_batchId_key" ON "mail_action_logs"("connectionId", "batchId");

-- AddForeignKey
ALTER TABLE "mail_sender_decisions" ADD CONSTRAINT "mail_sender_decisions_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sender_decisions" ADD CONSTRAINT "mail_sender_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sender_decisions" ADD CONSTRAINT "mail_sender_decisions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_action_logs" ADD CONSTRAINT "mail_action_logs_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_action_logs" ADD CONSTRAINT "mail_action_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_action_logs" ADD CONSTRAINT "mail_action_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
