-- CreateTable
CREATE TABLE "bot_pins" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "list" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT NOT NULL,
    "refreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_pins_botId_key" ON "bot_pins"("botId");

-- CreateIndex
CREATE INDEX "bot_pins_spaceId_idx" ON "bot_pins"("spaceId");

-- AddForeignKey
ALTER TABLE "bot_pins" ADD CONSTRAINT "bot_pins_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_pins" ADD CONSTRAINT "bot_pins_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
