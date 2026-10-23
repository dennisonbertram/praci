ALTER TABLE "company_events"
  ADD COLUMN "sourceClaimKeys" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "company_events" AS event
SET "sourceClaimKeys" = COALESCE((
  SELECT array_agg(DISTINCT evidence."sourceKey")
  FROM "company_evidence" AS evidence
  WHERE evidence."spaceId" = event."spaceId"
    AND evidence."ownerUserId" = event."ownerUserId"
    AND evidence."factKind" = 'event'
    AND evidence."factId" = event."id"
    AND evidence."sourceKind" <> 'manual'
), '{}');
