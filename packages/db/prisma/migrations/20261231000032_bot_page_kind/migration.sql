-- A page is Markdown with live blocks ("blocks") or one sandboxed HTML document ("html"). Fixed at creation.
ALTER TABLE "bot_pages" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'blocks';
ALTER TABLE "bot_pages" ADD CONSTRAINT "bot_pages_kind_check" CHECK ("kind" IN ('blocks', 'html'));
