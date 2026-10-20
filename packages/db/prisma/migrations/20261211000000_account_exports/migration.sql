CREATE TABLE "account_exports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT,
    "size" BIGINT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_exports_userId_createdAt_idx" ON "account_exports"("userId", "createdAt");
CREATE INDEX "account_exports_expiresAt_idx" ON "account_exports"("expiresAt");

-- One export at a time per user.
CREATE UNIQUE INDEX "account_exports_one_active_key" ON "account_exports"("userId") WHERE status IN ('pending', 'running');

ALTER TABLE "account_exports" ADD CONSTRAINT "account_exports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
