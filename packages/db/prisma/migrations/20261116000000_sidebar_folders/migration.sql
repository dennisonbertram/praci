-- Sidebar folders reuse bot_sections (a per-user, per-space named container). Folders remember
-- whether they are collapsed, and groups get a position so bots and groups can be ordered together.
ALTER TABLE "bot_sections" ADD COLUMN "collapsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chat_groups" ADD COLUMN "position" INTEGER;
