-- When a saved credential was last used, and when the site last rejected it (401/403).
ALTER TABLE "bot_secrets" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "bot_secrets" ADD COLUMN "needsAttentionAt" TIMESTAMP(3);
