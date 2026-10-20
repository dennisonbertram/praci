ALTER TABLE "data_room_items" ALTER COLUMN "size" TYPE BIGINT;
ALTER TABLE "data_room_items" ADD COLUMN "notIndexed" BOOLEAN NOT NULL DEFAULT false;
