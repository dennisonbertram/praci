-- A bot can have several named pages. The existing page becomes the first one, titled with the bot's name.
DROP INDEX "bot_pages_botId_key";

ALTER TABLE "bot_pages" ADD COLUMN "title" TEXT;

UPDATE "bot_pages" AS p
SET "title" = COALESCE(NULLIF(BTRIM(LEFT(b."name", 60)), ''), 'Page')
FROM "bots" AS b
WHERE b."id" = p."botId";

UPDATE "bot_pages" SET "title" = 'Page' WHERE "title" IS NULL;

ALTER TABLE "bot_pages" ALTER COLUMN "title" SET NOT NULL;

-- Case-insensitive, because bots address pages by title in any case.
CREATE UNIQUE INDEX "bot_pages_botId_title_key" ON "bot_pages"("botId", lower("title"));

CREATE INDEX "bot_pages_botId_idx" ON "bot_pages"("botId");
