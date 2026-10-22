-- Filing new mail attachments is opt-in. Existing rows keep the choice already stored.
ALTER TABLE "data_room_preferences" ALTER COLUMN "autoFileEmail" SET DEFAULT false;
