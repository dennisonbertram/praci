-- Mercury SAFE sync: Waiting for Mercury, the matched deposit and the sync throttle.
ALTER TABLE "contacts" ADD COLUMN "mercurySentAt" TIMESTAMP(3);

ALTER TABLE "safes" ADD COLUMN "financeTransactionId" TEXT;
CREATE UNIQUE INDEX "safes_financeTransactionId_key" ON "safes"("financeTransactionId");
ALTER TABLE "safes" ADD CONSTRAINT "safes_financeTransactionId_fkey" FOREIGN KEY ("financeTransactionId") REFERENCES "finance_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "safe_sync_states" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "needsReconnect" BOOLEAN NOT NULL DEFAULT false,
    "unreadable" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "safe_sync_states_pkey" PRIMARY KEY ("spaceId","userId")
);

ALTER TABLE "safe_sync_states" ADD CONSTRAINT "safe_sync_states_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "safe_sync_states" ADD CONSTRAINT "safe_sync_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
