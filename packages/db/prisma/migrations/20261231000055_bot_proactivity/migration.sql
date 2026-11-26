-- How far an agent goes beyond the request: low, medium or high. Existing agents stay on medium.
ALTER TABLE "bots" ADD COLUMN "proactivity" TEXT NOT NULL DEFAULT 'medium';
