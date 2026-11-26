-- AlterTable
ALTER TABLE "scratchpad_items" ADD COLUMN "mailConnectionId" TEXT,
ADD COLUMN "mailThreadId" TEXT,
ADD COLUMN "mailMessageId" TEXT;

-- CreateIndex
CREATE INDEX "scratchpad_items_mailConnectionId_idx" ON "scratchpad_items"("mailConnectionId");

-- One open item per bot and mail thread. Prisma cannot express a partial unique index.
CREATE UNIQUE INDEX "scratchpad_items_open_mail_thread_key"
ON "scratchpad_items" ("botId", "mailConnectionId", "mailThreadId")
WHERE "status" = 'open' AND "mailThreadId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "scratchpad_items" ADD CONSTRAINT "scratchpad_items_mailConnectionId_fkey" FOREIGN KEY ("mailConnectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
