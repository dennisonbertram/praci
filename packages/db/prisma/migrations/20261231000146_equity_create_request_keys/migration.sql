-- Client idempotency keys for the equity create paths, as migration 106 did for exercises. A retry
-- with the same key and request replays the first result; the hash detects a reused key.
-- The unique index is scoped by space and user; rows without a key (NULL) never collide.

ALTER TABLE "equity_certificates" ADD COLUMN "requestKey" UUID, ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "equity_certificates_spaceId_userId_requestKey_key"
ON "equity_certificates"("spaceId", "userId", "requestKey");

ALTER TABLE "equity_option_grants" ADD COLUMN "requestKey" UUID, ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "equity_option_grants_spaceId_userId_requestKey_key"
ON "equity_option_grants"("spaceId", "userId", "requestKey");

ALTER TABLE "equity_convertible_blocks" ADD COLUMN "requestKey" UUID, ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "equity_convertible_blocks_spaceId_userId_requestKey_key"
ON "equity_convertible_blocks"("spaceId", "userId", "requestKey");

ALTER TABLE "equity_convertibles" ADD COLUMN "requestKey" UUID, ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "equity_convertibles_spaceId_userId_requestKey_key"
ON "equity_convertibles"("spaceId", "userId", "requestKey");

ALTER TABLE "equity_warrants" ADD COLUMN "requestKey" UUID, ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "equity_warrants_spaceId_userId_requestKey_key"
ON "equity_warrants"("spaceId", "userId", "requestKey");

ALTER TABLE "equity_stakeholders" ADD COLUMN "requestKey" UUID, ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "equity_stakeholders_spaceId_userId_requestKey_key"
ON "equity_stakeholders"("spaceId", "userId", "requestKey");

ALTER TABLE "equity_transactions" ADD COLUMN "requestKey" UUID, ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "equity_transactions_spaceId_userId_requestKey_key"
ON "equity_transactions"("spaceId", "userId", "requestKey");
