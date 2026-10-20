-- AlterTable
ALTER TABLE "data_room_items" ADD COLUMN "thumbnailKey" TEXT,
ADD COLUMN "thumbnailTriedAt" TIMESTAMP(3),
ADD COLUMN "previewText" TEXT;

-- Existing items get their preview text from the text already extracted.
UPDATE "data_room_items" i SET "previewText" = left(btrim(t."text"), 400)
FROM "data_room_item_texts" t WHERE t."itemId" = i."id" AND btrim(t."text") <> '';
