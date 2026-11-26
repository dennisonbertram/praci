-- securities area: link a ledger convertible to the Fundraising SAFE it records.
ALTER TABLE "equity_convertibles" ADD COLUMN "sourceSafeId" TEXT;

CREATE INDEX "equity_convertibles_spaceId_userId_sourceSafeId_idx" ON "equity_convertibles"("spaceId", "userId", "sourceSafeId");
