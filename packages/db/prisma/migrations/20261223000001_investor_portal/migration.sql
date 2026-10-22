-- Investor portal: per-contact link tokens, sessions, document shares and the contact's portal dates.
ALTER TABLE "contacts" ADD COLUMN "portalLinkSentAt" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN "portalLastSeenAt" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN "portalBlockedAt" TIMESTAMP(3);

CREATE TABLE "investor_shares" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "dataRoomItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_shares_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "investor_portal_tokens" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_portal_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portal_sessions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "investor_shares_contactId_dataRoomItemId_key" ON "investor_shares"("contactId", "dataRoomItemId");
CREATE INDEX "investor_shares_spaceId_userId_idx" ON "investor_shares"("spaceId", "userId");
CREATE INDEX "investor_shares_dataRoomItemId_idx" ON "investor_shares"("dataRoomItemId");
CREATE UNIQUE INDEX "investor_portal_tokens_tokenHash_key" ON "investor_portal_tokens"("tokenHash");
CREATE INDEX "investor_portal_tokens_contactId_idx" ON "investor_portal_tokens"("contactId");
CREATE UNIQUE INDEX "portal_sessions_tokenHash_key" ON "portal_sessions"("tokenHash");
CREATE INDEX "portal_sessions_contactId_idx" ON "portal_sessions"("contactId");

ALTER TABLE "investor_shares" ADD CONSTRAINT "investor_shares_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_shares" ADD CONSTRAINT "investor_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_shares" ADD CONSTRAINT "investor_shares_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_shares" ADD CONSTRAINT "investor_shares_dataRoomItemId_fkey" FOREIGN KEY ("dataRoomItemId") REFERENCES "data_room_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_portal_tokens" ADD CONSTRAINT "investor_portal_tokens_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_portal_tokens" ADD CONSTRAINT "investor_portal_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_portal_tokens" ADD CONSTRAINT "investor_portal_tokens_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
