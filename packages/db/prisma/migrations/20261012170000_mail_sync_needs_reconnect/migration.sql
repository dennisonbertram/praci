-- AlterTable
ALTER TABLE "mail_sync_states" ADD COLUMN     "needsReconnect" BOOLEAN NOT NULL DEFAULT false;
