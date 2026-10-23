ALTER TABLE "company_events" ADD COLUMN "subjectKey" TEXT;

UPDATE "company_events"
SET "subjectKey" = 'legacy:' || "id";

ALTER TABLE "company_events" ALTER COLUMN "subjectKey" SET NOT NULL;

DROP INDEX "company_events_fingerprint_key";

CREATE UNIQUE INDEX "company_events_fingerprint_key" ON "company_events"(
  "spaceId", "ownerUserId", "kind", "normalizedTitle",
  COALESCE("occursOn", DATE '0001-01-01'), COALESCE("occursPrecision", ''),
  "subjectKey"
);
