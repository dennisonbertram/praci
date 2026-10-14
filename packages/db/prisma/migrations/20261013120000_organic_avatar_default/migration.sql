ALTER TABLE "user" ALTER COLUMN "avatarStyle" SET DEFAULT 'organic';
UPDATE "user" SET "avatarStyle" = 'organic' WHERE "avatarStyle" = 'robot';
