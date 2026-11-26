-- Saved read-only data calls on bot pages, and their stored results.

-- CreateTable
CREATE TABLE "page_sources" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "call" JSONB NOT NULL,
    "schedule" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "nextRefreshAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastRefreshAt" TIMESTAMP(3),
    "approvedCallHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_source_snapshots" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" JSONB NOT NULL,
    "bytes" INTEGER NOT NULL,

    CONSTRAINT "page_source_snapshots_pkey" PRIMARY KEY ("id")
);

-- Names are unique per page, ignoring case, because blocks refer to a source by name.
CREATE UNIQUE INDEX "page_sources_pageId_name_key" ON "page_sources"("pageId", lower("name"));

-- CreateIndex
CREATE INDEX "page_sources_spaceId_idx" ON "page_sources"("spaceId");

-- CreateIndex
CREATE INDEX "page_sources_status_nextRefreshAt_idx" ON "page_sources"("status", "nextRefreshAt");

-- CreateIndex
CREATE INDEX "page_source_snapshots_sourceId_fetchedAt_idx" ON "page_source_snapshots"("sourceId", "fetchedAt" DESC);

-- AddForeignKey
ALTER TABLE "page_sources" ADD CONSTRAINT "page_sources_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_sources" ADD CONSTRAINT "page_sources_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_sources" ADD CONSTRAINT "page_sources_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "bot_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_source_snapshots" ADD CONSTRAINT "page_source_snapshots_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_source_snapshots" ADD CONSTRAINT "page_source_snapshots_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "page_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for the other space tables.
ALTER TABLE "page_sources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_sources_tenant" ON "page_sources"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "page_sources_system" ON "page_sources"
  USING (current_setting('app.rls_bypass', true) = 'on');

ALTER TABLE "page_source_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_source_snapshots_tenant" ON "page_source_snapshots"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "page_source_snapshots_system" ON "page_source_snapshots"
  USING (current_setting('app.rls_bypass', true) = 'on');
