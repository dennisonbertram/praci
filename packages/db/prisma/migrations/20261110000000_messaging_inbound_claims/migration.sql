-- CreateTable
CREATE TABLE "messaging_inbound_claims" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_inbound_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_poll_cursors" (
    "provider" TEXT NOT NULL,
    "cursorMs" BIGINT,
    "leaseUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_poll_cursors_pkey" PRIMARY KEY ("provider")
);

-- CreateIndex
CREATE UNIQUE INDEX "messaging_inbound_claims_key_key" ON "messaging_inbound_claims"("key");

-- CreateIndex
CREATE INDEX "messaging_inbound_claims_createdAt_idx" ON "messaging_inbound_claims"("createdAt");
