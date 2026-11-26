DROP INDEX "equity_convertibles_spaceId_userId_sourceSafeId_idx";
CREATE UNIQUE INDEX "equity_convertibles_spaceId_userId_sourceSafeId_key"
  ON "equity_convertibles"("spaceId", "userId", "sourceSafeId");

ALTER TABLE "equity_ledgers" ADD CONSTRAINT "equity_ledgers_safeBoardApprovedCents_nonnegative_check"
  CHECK ("safeBoardApprovedCents" IS NULL OR "safeBoardApprovedCents" >= 0);
