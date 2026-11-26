-- A row of a reply batch can be a new email: no message answered and no thread. It also records whether
-- the run had read outside content, and the place it took in the account's daily new-recipient limit.
ALTER TABLE "mail_reply_items"
  ALTER COLUMN "replyToId" DROP NOT NULL,
  ALTER COLUMN "providerThreadId" DROP NOT NULL,
  ADD COLUMN "outsideContent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "newRecipientCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "newRecipientAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "mail_reply_items_connectionId_newRecipientAt_idx" ON "mail_reply_items"("connectionId", "newRecipientAt");
