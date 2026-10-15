-- CreateTable
CREATE TABLE "bot_pages" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_page_revisions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "sourceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_page_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_pages_botId_key" ON "bot_pages"("botId");

-- CreateIndex
CREATE INDEX "bot_pages_spaceId_idx" ON "bot_pages"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_page_revisions_pageId_revision_key" ON "bot_page_revisions"("pageId", "revision");

-- AddForeignKey
ALTER TABLE "bot_pages" ADD CONSTRAINT "bot_pages_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_pages" ADD CONSTRAINT "bot_pages_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_page_revisions" ADD CONSTRAINT "bot_page_revisions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "bot_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

