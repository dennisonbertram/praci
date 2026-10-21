-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "botId" TEXT;

-- CreateIndex
CREATE INDEX "contacts_botId_idx" ON "contacts"("botId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
