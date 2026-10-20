-- AlterTable
ALTER TABLE "user" ADD COLUMN "hiddenPages" TEXT[] DEFAULT ARRAY[]::TEXT[];
