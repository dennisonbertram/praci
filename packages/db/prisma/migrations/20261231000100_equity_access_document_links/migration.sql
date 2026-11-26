-- CreateTable
CREATE TABLE "equity_document_links" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dataRoomItemId" TEXT NOT NULL,
    "stakeholderId" TEXT,
    "certificateId" TEXT,
    "roundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equity_document_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "equity_document_links_one_target" CHECK (
      num_nonnulls("stakeholderId", "certificateId", "roundId") = 1
    )
);

-- CreateIndex
CREATE INDEX "equity_document_links_spaceId_userId_dataRoomItemId_idx" ON "equity_document_links"("spaceId", "userId", "dataRoomItemId");

-- AddForeignKey
ALTER TABLE "equity_document_links" ADD CONSTRAINT "equity_document_links_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for every equity table.
ALTER TABLE "equity_document_links" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equity_document_links_tenant" ON "equity_document_links"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "equity_document_links_system" ON "equity_document_links"
  USING (current_setting('app.rls_bypass', true) = 'on');
