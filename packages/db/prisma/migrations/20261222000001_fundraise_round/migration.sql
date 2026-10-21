-- Fundraising: rounds, and the prospect pipeline fields on contacts.
CREATE TABLE "fundraise_rounds" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetCents" BIGINT NOT NULL,
    "capCents" BIGINT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraise_rounds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fundraise_rounds_spaceId_userId_idx" ON "fundraise_rounds"("spaceId", "userId");
-- One open round per space and user.
CREATE UNIQUE INDEX "fundraise_rounds_open_key" ON "fundraise_rounds"("spaceId", "userId") WHERE "closedAt" IS NULL;

ALTER TABLE "fundraise_rounds" ADD CONSTRAINT "fundraise_rounds_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fundraise_rounds" ADD CONSTRAINT "fundraise_rounds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contacts" ADD COLUMN "stage" TEXT;
ALTER TABLE "contacts" ADD COLUMN "checkSizeCents" BIGINT;
ALTER TABLE "contacts" ADD COLUMN "nextStep" TEXT;
ALTER TABLE "contacts" ADD COLUMN "roundId" TEXT;
CREATE INDEX "contacts_roundId_idx" ON "contacts"("roundId");
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "fundraise_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
