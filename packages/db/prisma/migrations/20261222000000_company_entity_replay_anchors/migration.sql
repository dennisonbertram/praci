ALTER TABLE "company_entities"
  ADD COLUMN "sourceClaimKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "company_entities" AS entity
SET "sourceClaimKeys" = ARRAY(
  SELECT DISTINCT evidence."sourceKey"
  FROM "company_evidence" AS evidence
  WHERE evidence."spaceId" = entity."spaceId"
    AND evidence."ownerUserId" = entity."ownerUserId"
    AND evidence."factKind" = 'entity'
    AND evidence."factId" = entity."id"
    AND evidence."sourceKind" <> 'manual'
);
