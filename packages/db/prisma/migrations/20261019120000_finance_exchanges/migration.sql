-- CreateTable
CREATE TABLE "finance_exchange_connections" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_exchange_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_exchange_balances" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "usdPrice" TEXT,
    "usdValueCents" BIGINT,
    "bucket" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_exchange_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_exchange_snapshots" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "stablecoinCents" BIGINT NOT NULL,
    "otherCryptoCents" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_exchange_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_exchange_connections_spaceId_userId_provider_key" ON "finance_exchange_connections"("spaceId", "userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "finance_exchange_balances_connectionId_asset_key" ON "finance_exchange_balances"("connectionId", "asset");

-- CreateIndex
CREATE INDEX "finance_exchange_balances_spaceId_userId_idx" ON "finance_exchange_balances"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_exchange_snapshots_connectionId_day_key" ON "finance_exchange_snapshots"("connectionId", "day");

-- CreateIndex
CREATE INDEX "finance_exchange_snapshots_spaceId_userId_day_idx" ON "finance_exchange_snapshots"("spaceId", "userId", "day");

-- AddForeignKey
ALTER TABLE "finance_exchange_balances" ADD CONSTRAINT "finance_exchange_balances_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "finance_exchange_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_exchange_snapshots" ADD CONSTRAINT "finance_exchange_snapshots_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "finance_exchange_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
