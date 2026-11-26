-- AlterTable
ALTER TABLE "artifact_shares" ADD COLUMN "openWindowStart" TIMESTAMP(3),
ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0;
