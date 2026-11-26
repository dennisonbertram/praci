-- Options area: warrants, a simple ledger with issue and cancel.
CREATE TABLE "equity_warrants" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "exercisePrice" DECIMAL(24,10) NOT NULL,
    "issueDate" DATE NOT NULL,
    "expirationDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'outstanding',
    "canceledOn" DATE,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_warrants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equity_warrants_id_spaceId_userId_key" ON "equity_warrants"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "equity_warrants_spaceId_userId_label_key" ON "equity_warrants"("spaceId", "userId", "label");
CREATE INDEX "equity_warrants_spaceId_userId_status_idx" ON "equity_warrants"("spaceId", "userId", "status");

ALTER TABLE "equity_warrants" ADD CONSTRAINT "equity_warrants_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equity_warrants" ADD CONSTRAINT "equity_warrants_stakeholderId_spaceId_userId_fkey" FOREIGN KEY ("stakeholderId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_warrants" ADD CONSTRAINT "equity_warrants_shareClassId_spaceId_userId_fkey" FOREIGN KEY ("shareClassId", "spaceId", "userId") REFERENCES "equity_share_classes"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "equity_warrants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equity_warrants_tenant" ON "equity_warrants"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "equity_warrants_system" ON "equity_warrants"
  USING (current_setting('app.rls_bypass', true) = 'on');
