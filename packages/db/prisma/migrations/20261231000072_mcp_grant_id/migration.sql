-- An OAuth connection is one grant. Its id travels in the consent reference, so authorization
-- codes, refresh tokens and access tokens all name the row they were issued for.
ALTER TABLE "mcp_connections" ADD COLUMN "grantId" TEXT;
UPDATE "mcp_connections" SET "grantId" = gen_random_uuid()::text WHERE "kind" = 'oauth';
CREATE UNIQUE INDEX "mcp_connections_grantId_key" ON "mcp_connections"("grantId");

-- Two approvals that raced could leave two live grants for one member, client and Space.
-- Keep the newest, which is the one calls already resolved to.
UPDATE "mcp_connections" c
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE c."kind" = 'oauth'
  AND c."revokedAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "mcp_connections" n
    WHERE n."kind" = 'oauth'
      AND n."revokedAt" IS NULL
      AND n."userId" = c."userId"
      AND n."spaceId" = c."spaceId"
      AND n."oauthClientId" = c."oauthClientId"
      AND (n."createdAt", n."id") > (c."createdAt", c."id")
  );

-- One live grant per member, client and Space, so concurrent approvals cannot create a second.
CREATE UNIQUE INDEX "mcp_connections_one_live_grant_key" ON "mcp_connections"("userId", "spaceId", "oauthClientId")
  WHERE "kind" = 'oauth' AND "revokedAt" IS NULL;

-- Refresh tokens and consent from before grants had ids name only the Space, so no grant can
-- vouch for them and the token endpoint now refuses them. Delete them rather than map them to a
-- grant: one could belong to a grant the member already revoked, and a rotated one presented
-- again would make Better Auth delete every refresh token of that member and client. Their
-- clients authorize again once. Access tokens issued from them go with them (ON DELETE CASCADE).
DELETE FROM "oauth_refresh_token" WHERE "referenceId" IS NULL OR "referenceId" NOT LIKE '%:%';
DELETE FROM "oauth_consent" WHERE "referenceId" IS NULL OR "referenceId" NOT LIKE '%:%';
