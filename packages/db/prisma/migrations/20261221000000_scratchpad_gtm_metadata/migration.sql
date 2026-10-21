ALTER TABLE "scratchpad_items"
ADD COLUMN "category" TEXT,
ADD COLUMN "channel" TEXT,
ADD COLUMN "target" TEXT,
ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "proof" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedBy" TEXT;
