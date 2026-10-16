ALTER TABLE "data_room_items" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "data_room_items" ADD COLUMN "failures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "data_room_items" ADD COLUMN "classifiedAt" TIMESTAMP(3);
ALTER TABLE "space_model_preferences" ADD COLUMN "embeddingModel" TEXT;

CREATE TABLE "data_room_item_texts" (
    "itemId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "data_room_item_texts_pkey" PRIMARY KEY ("itemId")
);
CREATE INDEX "data_room_item_texts_spaceId_userId_idx" ON "data_room_item_texts"("spaceId", "userId");
ALTER TABLE "data_room_item_texts" ADD CONSTRAINT "data_room_item_texts_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "data_room_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_room_item_texts" ADD CONSTRAINT "data_room_item_texts_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
