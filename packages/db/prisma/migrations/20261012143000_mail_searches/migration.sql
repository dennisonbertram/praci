-- CreateTable
CREATE TABLE "mail_searches" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "resume" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_search_rows" (
    "searchId" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "mail_search_rows_pkey" PRIMARY KEY ("searchId","line")
);

-- CreateIndex
CREATE INDEX "mail_searches_spaceId_userId_botId_idx" ON "mail_searches"("spaceId", "userId", "botId");

-- CreateIndex
CREATE INDEX "mail_searches_expiresAt_idx" ON "mail_searches"("expiresAt");

-- AddForeignKey
ALTER TABLE "mail_searches" ADD CONSTRAINT "mail_searches_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_searches" ADD CONSTRAINT "mail_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_searches" ADD CONSTRAINT "mail_searches_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_search_rows" ADD CONSTRAINT "mail_search_rows_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "mail_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
