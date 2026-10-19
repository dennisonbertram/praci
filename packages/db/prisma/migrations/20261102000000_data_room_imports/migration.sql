-- CreateTable
CREATE TABLE "data_room_imports" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "data_room_imports_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "data_room_items" ADD COLUMN "importId" TEXT;

-- CreateIndex
CREATE INDEX "data_room_imports_spaceId_userId_createdAt_idx" ON "data_room_imports"("spaceId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "data_room_items_importId_idx" ON "data_room_items"("importId");

-- AddForeignKey
ALTER TABLE "data_room_imports" ADD CONSTRAINT "data_room_imports_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_room_items" ADD CONSTRAINT "data_room_items_importId_fkey" FOREIGN KEY ("importId") REFERENCES "data_room_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
