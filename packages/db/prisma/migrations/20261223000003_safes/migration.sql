-- SAFEs: the founder's native records and, later, a read-only cache of Mercury's.
CREATE TABLE "safes" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'native',
    "externalId" TEXT,
    "contactId" TEXT,
    "roundId" TEXT,
    "investorName" TEXT NOT NULL,
    "investorEmail" TEXT,
    "amountCents" BIGINT NOT NULL,
    "valuationType" TEXT NOT NULL DEFAULT 'post_money_cap',
    "capCents" BIGINT,
    "discountPercent" DOUBLE PRECISION,
    "mfn" BOOLEAN NOT NULL DEFAULT false,
    "proRata" BOOLEAN NOT NULL DEFAULT false,
    "governingState" TEXT,
    "investmentDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "signedByOwnerAt" TIMESTAMP(3),
    "signedByInvestorAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "safes_spaceId_userId_source_externalId_key" ON "safes"("spaceId", "userId", "source", "externalId");
CREATE INDEX "safes_spaceId_userId_idx" ON "safes"("spaceId", "userId");
CREATE INDEX "safes_contactId_idx" ON "safes"("contactId");
CREATE INDEX "safes_roundId_idx" ON "safes"("roundId");

ALTER TABLE "safes" ADD CONSTRAINT "safes_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "safes" ADD CONSTRAINT "safes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "safes" ADD CONSTRAINT "safes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "safes" ADD CONSTRAINT "safes_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "fundraise_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
