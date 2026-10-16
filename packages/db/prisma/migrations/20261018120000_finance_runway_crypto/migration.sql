-- CreateTable
CREATE TABLE "finance_preferences" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runwayCrypto" TEXT NOT NULL DEFAULT 'bank',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_crypto_snapshots" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "stablecoinCents" BIGINT NOT NULL,
    "otherCryptoCents" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_crypto_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_preferences_spaceId_userId_key" ON "finance_preferences"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_crypto_snapshots_walletId_day_key" ON "finance_crypto_snapshots"("walletId", "day");

-- CreateIndex
CREATE INDEX "finance_crypto_snapshots_spaceId_userId_day_idx" ON "finance_crypto_snapshots"("spaceId", "userId", "day");

-- AddForeignKey
ALTER TABLE "finance_crypto_snapshots" ADD CONSTRAINT "finance_crypto_snapshots_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "finance_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
