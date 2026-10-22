-- Audit, 409A and DocuSign requests filed from arriving mail, or by the Investors agent.
CREATE TABLE "audit_requests" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fund" TEXT NOT NULL,
    "fundKey" TEXT NOT NULL,
    "asOf" DATE,
    "asOfMatched" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dataRoomItemId" TEXT,
    "mailThreadId" TEXT,
    "connectionId" TEXT,
    "draftRef" TEXT,
    "senderKnown" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "draftStartedAt" TIMESTAMP(3),
    "draftedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "lastMailAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audit_requests_spaceId_userId_mailThreadId_key" ON "audit_requests"("spaceId", "userId", "mailThreadId");
CREATE INDEX "audit_requests_spaceId_userId_status_idx" ON "audit_requests"("spaceId", "userId", "status");
CREATE INDEX "audit_requests_spaceId_userId_draftStartedAt_idx" ON "audit_requests"("spaceId", "userId", "draftStartedAt");

ALTER TABLE "audit_requests" ADD CONSTRAINT "audit_requests_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_requests" ADD CONSTRAINT "audit_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Two equivalent requests added by the agent (no mail thread) cannot both stay open.
CREATE UNIQUE INDEX "audit_requests_agent_open_key" ON "audit_requests"("spaceId", "userId", "fundKey", COALESCE("asOf", DATE '1970-01-01')) WHERE "mailThreadId" IS NULL AND "status" IN ('open', 'drafted');
