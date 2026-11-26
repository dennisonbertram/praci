-- A directly connected source (MCP, API, GraphQL) gets its own agent and an access list.
ALTER TABLE "capability_installs" ADD COLUMN "agentBotId" TEXT;
ALTER TABLE "capability_installs" ADD COLUMN "allAgents" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "capability_installs" ADD COLUMN "agentShared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "capability_installs" ADD COLUMN "writesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "capability_installs"
  ADD CONSTRAINT "capability_installs_agentBotId_fkey"
  FOREIGN KEY ("agentBotId") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "bot_source_access" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_source_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bot_source_access_installId_botId_key" ON "bot_source_access"("installId", "botId");
CREATE INDEX "bot_source_access_botId_idx" ON "bot_source_access"("botId");
ALTER TABLE "bot_source_access" ADD CONSTRAINT "bot_source_access_installId_fkey"
  FOREIGN KEY ("installId") REFERENCES "capability_installs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_source_access" ADD CONSTRAINT "bot_source_access_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sources connected before this stay open to every internal agent, changes included (each still
-- asks), so nothing in use stops working. Only sources connected from now on start private.
UPDATE "capability_installs"
SET "allAgents" = true, "agentShared" = true, "writesEnabled" = true
WHERE "kind" IN ('mcp', 'api', 'graphql');
