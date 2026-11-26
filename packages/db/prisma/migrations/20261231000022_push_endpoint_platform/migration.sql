-- Which push service a token belongs to; existing tokens are Expo tokens.

-- AlterTable
ALTER TABLE "notification_endpoints" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'expo';
