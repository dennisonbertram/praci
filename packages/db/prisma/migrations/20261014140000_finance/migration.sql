-- CreateTable
CREATE TABLE "finance_accounts" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mcpServerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastFour" TEXT,
    "kind" TEXT NOT NULL,
    "balanceCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mcpServerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "accountExternalId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "purchasedAt" TIMESTAMP(3),
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "vendorKey" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "cardLastFour" TEXT,
    "cardholder" TEXT,
    "memo" TEXT,
    "hasReceipt" BOOLEAN NOT NULL DEFAULT false,
    "dashboardUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_treasury_yields" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mcpServerId" TEXT NOT NULL,
    "accountExternalId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "dividendsCents" BIGINT NOT NULL,
    "feeCents" BIGINT NOT NULL,
    "netCents" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_treasury_yields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_bills" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mcpServerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorKey" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_sync_states" (
    "mcpServerId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "needsReconnect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "finance_sync_states_pkey" PRIMARY KEY ("mcpServerId")
);

-- CreateIndex
CREATE INDEX "finance_accounts_spaceId_userId_idx" ON "finance_accounts"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounts_mcpServerId_externalId_key" ON "finance_accounts"("mcpServerId", "externalId");

-- CreateIndex
CREATE INDEX "finance_transactions_spaceId_userId_postedAt_idx" ON "finance_transactions"("spaceId", "userId", "postedAt");

-- CreateIndex
CREATE INDEX "finance_transactions_spaceId_userId_vendorKey_idx" ON "finance_transactions"("spaceId", "userId", "vendorKey");

-- CreateIndex
CREATE UNIQUE INDEX "finance_transactions_mcpServerId_externalId_key" ON "finance_transactions"("mcpServerId", "externalId");

-- CreateIndex
CREATE INDEX "finance_treasury_yields_spaceId_userId_month_idx" ON "finance_treasury_yields"("spaceId", "userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "finance_treasury_yields_mcpServerId_accountExternalId_month_key" ON "finance_treasury_yields"("mcpServerId", "accountExternalId", "month");

-- CreateIndex
CREATE INDEX "finance_bills_spaceId_userId_dueAt_idx" ON "finance_bills"("spaceId", "userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_bills_mcpServerId_externalId_key" ON "finance_bills"("mcpServerId", "externalId");

-- AddForeignKey
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_treasury_yields" ADD CONSTRAINT "finance_treasury_yields_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bills" ADD CONSTRAINT "finance_bills_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_sync_states" ADD CONSTRAINT "finance_sync_states_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

