-- Investor and board updates: drafts, per-recipient deliveries and the sent record.
CREATE TABLE "investor_updates" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "recipientContactIds" TEXT[],
    "fromConnectionId" TEXT,
    "deliveries" JSONB NOT NULL DEFAULT '{}',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "investor_updates_spaceId_userId_createdAt_idx" ON "investor_updates"("spaceId", "userId", "createdAt");

ALTER TABLE "investor_updates" ADD CONSTRAINT "investor_updates_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_updates" ADD CONSTRAINT "investor_updates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
