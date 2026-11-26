-- When a routine's prompt last changed. Existing rows start at their creation time.
ALTER TABLE "routines" ADD COLUMN "promptUpdatedAt" TIMESTAMP(3);
UPDATE "routines" SET "promptUpdatedAt" = "createdAt";
