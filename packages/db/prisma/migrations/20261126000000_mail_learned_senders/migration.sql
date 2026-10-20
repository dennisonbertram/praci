ALTER TABLE "mail_sender_stats" ADD COLUMN "learnedPile" TEXT,
ADD COLUMN "learnedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "learnedAt" TIMESTAMP(3),
ADD COLUMN "learnedForgottenAt" TIMESTAMP(3);
