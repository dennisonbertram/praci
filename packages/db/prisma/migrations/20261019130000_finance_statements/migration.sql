-- Statement-fed accounts and transactions have no MCP server.
ALTER TABLE "finance_accounts" ALTER COLUMN "mcpServerId" DROP NOT NULL;
ALTER TABLE "finance_transactions" ALTER COLUMN "mcpServerId" DROP NOT NULL;

-- A NULL server makes the (mcpServerId, externalId) unique index useless, so statement rows get their own.
CREATE UNIQUE INDEX "finance_accounts_statement_key"
  ON "finance_accounts" ("spaceId", "userId", "externalId") WHERE "provider" = 'statement';
CREATE UNIQUE INDEX "finance_transactions_statement_key"
  ON "finance_transactions" ("spaceId", "userId", "accountExternalId", "externalId") WHERE "provider" = 'statement';

-- CreateTable
CREATE TABLE "finance_statements" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "parsed" JSONB,
    "status" TEXT NOT NULL,
    "check" JSONB,
    "warnings" JSONB NOT NULL,
    "error" TEXT,
    "institution" TEXT,
    "accountLast4" TEXT,
    "periodStart" TEXT,
    "periodEnd" TEXT,
    "openingBalanceCents" BIGINT,
    "closingBalanceCents" BIGINT,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "createsAccount" BOOLEAN NOT NULL DEFAULT false,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_statements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_statements_spaceId_userId_uploadedAt_idx" ON "finance_statements"("spaceId", "userId", "uploadedAt");
CREATE INDEX "finance_statements_accountId_status_idx" ON "finance_statements"("accountId", "status");

ALTER TABLE "finance_statements" ADD CONSTRAINT "finance_statements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
