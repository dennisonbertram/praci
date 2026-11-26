-- A sidebar row is now a template (templateKey) or one of the user's bot pages (pageId).
ALTER TABLE "sidebar_pages" ALTER COLUMN "templateKey" DROP NOT NULL;
ALTER TABLE "sidebar_pages" ADD COLUMN "pageId" TEXT;

CREATE UNIQUE INDEX "sidebar_pages_spaceId_userId_pageId_key" ON "sidebar_pages"("spaceId", "userId", "pageId");

-- Deleting a page removes its sidebar rows.
ALTER TABLE "sidebar_pages" ADD CONSTRAINT "sidebar_pages_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "bot_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sidebar_pages" ADD CONSTRAINT "sidebar_pages_one_target" CHECK (("templateKey" IS NULL) <> ("pageId" IS NULL));
