ALTER TABLE "company_edges"
  ADD COLUMN "claimFingerprints" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "company_events"
  ADD COLUMN "claimFingerprints" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "company_edges" AS edge
SET "claimFingerprints" = COALESCE((
  SELECT array_agg(DISTINCT substring(evidence."sourceKey" FROM ':claim:([0-9a-f]+)$'))
  FROM "company_evidence" AS evidence
  WHERE evidence."spaceId" = edge."spaceId"
    AND evidence."ownerUserId" = edge."ownerUserId"
    AND evidence."factKind" = 'edge'
    AND evidence."factId" = edge."id"
    AND evidence."sourceKey" ~ ':claim:[0-9a-f]+$'
), '{}');

UPDATE "company_events" AS event
SET "claimFingerprints" = COALESCE((
  SELECT array_agg(DISTINCT substring(evidence."sourceKey" FROM ':claim:([0-9a-f]+)$'))
  FROM "company_evidence" AS evidence
  WHERE evidence."spaceId" = event."spaceId"
    AND evidence."ownerUserId" = event."ownerUserId"
    AND evidence."factKind" = 'event'
    AND evidence."factId" = event."id"
    AND evidence."sourceKey" ~ ':claim:[0-9a-f]+$'
), '{}');
