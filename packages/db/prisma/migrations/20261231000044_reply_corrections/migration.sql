-- The user's "no reply needed" corrections: per message, and counted per sender.
ALTER TABLE "mail_messages" ADD COLUMN "replyDismissedAt" TIMESTAMP(3);
ALTER TABLE "mail_sender_stats" ADD COLUMN "noReplyCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "noReplyAt" TIMESTAMP(3);
