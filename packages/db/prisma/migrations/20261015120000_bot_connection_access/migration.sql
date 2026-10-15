
-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "allAgents" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "bot_connection_access" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_connection_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_connection_access_botId_idx" ON "bot_connection_access"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_connection_access_connectionId_botId_key" ON "bot_connection_access"("connectionId", "botId");

-- AddForeignKey
ALTER TABLE "bot_connection_access" ADD CONSTRAINT "bot_connection_access_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_connection_access" ADD CONSTRAINT "bot_connection_access_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

