-- Sharing an agent-linked connection is its own setting, so turning every other agent off keeps it on.
ALTER TABLE "connections" ADD COLUMN "agentShared" BOOLEAN NOT NULL DEFAULT false;

-- Existing shares stay shared; no access row changes.
UPDATE "connections" c SET "agentShared" = true
WHERE c."agentBotId" IS NOT NULL
  AND (c."allAgents" OR EXISTS (
    SELECT 1 FROM "bot_connection_access" a
    WHERE a."connectionId" = c.id AND a."botId" <> c."agentBotId"));
