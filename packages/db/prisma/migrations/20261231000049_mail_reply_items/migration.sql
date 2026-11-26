-- One reply of a mail_reply_batch call: the owner reviews these on one card, and each is sent from its row.

-- CreateTable
CREATE TABLE "mail_reply_items" (
    "id" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "replyToId" TEXT NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    "to" TEXT[],
    "cc" TEXT[],
    "bcc" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "seenMessageId" TEXT,
    "approvedHash" TEXT,
    "dispatch" TEXT NOT NULL DEFAULT 'reviewing',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_reply_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_reply_items_effectId_position_key" ON "mail_reply_items"("effectId", "position");

-- CreateIndex
CREATE INDEX "mail_reply_items_spaceId_userId_idx" ON "mail_reply_items"("spaceId", "userId");

-- CreateIndex
CREATE INDEX "mail_reply_items_connectionId_idx" ON "mail_reply_items"("connectionId");

-- CreateIndex
CREATE INDEX "mail_reply_items_dispatch_updatedAt_idx" ON "mail_reply_items"("dispatch", "updatedAt");

-- AddForeignKey
ALTER TABLE "mail_reply_items" ADD CONSTRAINT "mail_reply_items_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "external_effects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_reply_items" ADD CONSTRAINT "mail_reply_items_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_reply_items" ADD CONSTRAINT "mail_reply_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_reply_items" ADD CONSTRAINT "mail_reply_items_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for external_actions.
ALTER TABLE "mail_reply_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mail_reply_items_tenant" ON "mail_reply_items"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "mail_reply_items_system" ON "mail_reply_items"
  USING (current_setting('app.rls_bypass', true) = 'on');
