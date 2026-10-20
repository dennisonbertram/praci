-- AlterTable
ALTER TABLE "mail_messages" ADD COLUMN     "isSpam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pile" TEXT,
ADD COLUMN     "rulePile" TEXT,
ADD COLUMN     "ruleReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "signals" JSONB,
ADD COLUMN     "signalsVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "mail_sender_stats" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "lastReceivedAt" TIMESTAMP(3),
    "unsubscribeTarget" TEXT,
    "oneClick" BOOLEAN NOT NULL DEFAULT false,
    "bulk" BOOLEAN NOT NULL DEFAULT false,
    "priorContact" BOOLEAN,
    "priorContactCheckedAt" TIMESTAMP(3),

    CONSTRAINT "mail_sender_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_sender_stats_connectionId_senderAddress_key" ON "mail_sender_stats"("connectionId", "senderAddress");

-- AddForeignKey
ALTER TABLE "mail_sender_stats" ADD CONSTRAINT "mail_sender_stats_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sender_stats" ADD CONSTRAINT "mail_sender_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sender_stats" ADD CONSTRAINT "mail_sender_stats_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
