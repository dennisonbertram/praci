-- AlterTable
ALTER TABLE "mcp_servers" ADD COLUMN "agentBotId" TEXT,
ADD COLUMN "agentExclusive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "mcp_servers_agentBotId_idx" ON "mcp_servers"("agentBotId");

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_agentBotId_fkey" FOREIGN KEY ("agentBotId") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
