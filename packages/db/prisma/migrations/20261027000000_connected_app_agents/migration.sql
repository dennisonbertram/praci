ALTER TABLE "connections"
ADD COLUMN "writesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "agentBotId" TEXT;

CREATE INDEX "connections_agentBotId_idx" ON "connections"("agentBotId");

ALTER TABLE "connections"
ADD CONSTRAINT "connections_agentBotId_fkey"
FOREIGN KEY ("agentBotId") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
