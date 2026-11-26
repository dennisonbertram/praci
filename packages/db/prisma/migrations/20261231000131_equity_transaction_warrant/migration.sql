-- A stakeholder merge moves warrants, so the audit table needs a warrant reference like the other
-- securities have. Plain Prisma forms only (nullable column, index, tenant composite foreign key).
ALTER TABLE "equity_transactions" ADD COLUMN "warrantId" TEXT;

CREATE INDEX "equity_transactions_warrantId_idx" ON "equity_transactions"("warrantId");

ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_warrantId_spaceId_userId_fkey"
  FOREIGN KEY ("warrantId", "spaceId", "userId") REFERENCES "equity_warrants"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
