-- CreateTable
CREATE TABLE "finance_wallets" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ensName" TEXT,
    "label" TEXT,
    "type" TEXT NOT NULL,
    "safeOwners" JSONB,
    "safeThreshold" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_crypto_holdings" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "rawBalance" TEXT NOT NULL,
    "usdPrice" TEXT,
    "usdValueCents" BIGINT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_crypto_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_wallets_spaceId_userId_idx" ON "finance_wallets"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_wallets_spaceId_userId_address_key" ON "finance_wallets"("spaceId", "userId", "address");

-- CreateIndex
CREATE INDEX "finance_crypto_holdings_spaceId_userId_idx" ON "finance_crypto_holdings"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_crypto_holdings_walletId_chainId_tokenAddress_key" ON "finance_crypto_holdings"("walletId", "chainId", "tokenAddress");

-- AddForeignKey
ALTER TABLE "finance_crypto_holdings" ADD CONSTRAINT "finance_crypto_holdings_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "finance_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
