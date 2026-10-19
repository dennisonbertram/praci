-- AlterTable
ALTER TABLE "mail_sync_states" ADD COLUMN     "resumeCursor" TEXT,
ADD COLUMN     "resumeStartedAt" TIMESTAMP(3);
