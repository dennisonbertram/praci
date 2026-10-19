-- Moving to the shared gate requires fresh consent for writes. Preserve all assignment rows.
UPDATE "mcp_servers" AS server
SET "agentBotId" = (
    SELECT bot."id"
    FROM "bots" AS bot
    WHERE bot."spaceId" = server."spaceId"
      AND bot."userId" = server."userId"
      AND bot."spawnKey" = 'carta-agent:' || server."userId"
      AND bot."archivedAt" IS NULL
  ),
  "agentExclusive" = EXISTS (
    SELECT 1
    FROM "bots" AS bot
    WHERE bot."spaceId" = server."spaceId"
      AND bot."userId" = server."userId"
      AND bot."spawnKey" = 'carta-agent:' || server."userId"
      AND bot."archivedAt" IS NULL
  ),
  "writesEnabled" = false
WHERE server."endpoint" ~* '^https://([^/?#@]*@)?mcp\.app\.carta\.com(:443)?([/?#]|$)';
