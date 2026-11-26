ALTER TABLE "equity_convertibles" ADD COLUMN "closedOn" DATE;

WITH qualifying_terminal_transition AS (
  SELECT DISTINCT ON (audit_row."spaceId", audit_row."userId", audit_row."convertibleId")
    audit_row."spaceId",
    audit_row."userId",
    audit_row."convertibleId",
    CASE
      WHEN NULLIF(audit_row."after"->>'closedOn', '') IS NOT NULL
        THEN (audit_row."after"->>'closedOn')::date
      WHEN convertible."status" = 'canceled'
        AND NULLIF(audit_row."after"->>'canceledOn', '') IS NOT NULL
        THEN (audit_row."after"->>'canceledOn')::date
      ELSE audit_row."effectiveDate"
    END AS "closureDate"
  FROM "equity_transactions" AS audit_row
  JOIN "equity_convertibles" AS convertible
    ON convertible."id" = audit_row."convertibleId"
   AND convertible."spaceId" = audit_row."spaceId"
   AND convertible."userId" = audit_row."userId"
  WHERE convertible."closedOn" IS NULL
    AND convertible."status" IN ('repaid', 'canceled', 'converted')
    AND audit_row."before" IS NOT NULL
    AND audit_row."after" IS NOT NULL
    AND audit_row."before"->>'status' IS DISTINCT FROM audit_row."after"->>'status'
    AND audit_row."after"->>'status' = convertible."status"
    AND (
      NULLIF(audit_row."after"->>'closedOn', '') IS NOT NULL
      OR (
        convertible."status" = 'canceled'
        AND (
          audit_row."kind" = 'cancel'
          OR NULLIF(audit_row."after"->>'canceledOn', '') IS NOT NULL
        )
      )
      OR (convertible."status" = 'converted' AND audit_row."kind" = 'convert')
    )
    AND CASE
      WHEN NULLIF(audit_row."after"->>'closedOn', '') IS NOT NULL
        THEN (audit_row."after"->>'closedOn')::date
      WHEN convertible."status" = 'canceled'
        AND NULLIF(audit_row."after"->>'canceledOn', '') IS NOT NULL
        THEN (audit_row."after"->>'canceledOn')::date
      ELSE audit_row."effectiveDate"
    END >= convertible."issueDate"
  ORDER BY audit_row."spaceId", audit_row."userId", audit_row."convertibleId",
    audit_row."createdAt" DESC, audit_row."id" DESC
)
UPDATE "equity_convertibles" AS convertible
SET "closedOn" = transition."closureDate"
FROM qualifying_terminal_transition AS transition
WHERE convertible."id" = transition."convertibleId"
  AND convertible."spaceId" = transition."spaceId"
  AND convertible."userId" = transition."userId"
  AND convertible."closedOn" IS NULL
  AND convertible."status" IN ('repaid', 'canceled', 'converted');

UPDATE "equity_convertibles"
SET "closedOn" = "canceledOn"
WHERE "status" = 'canceled'
  AND "closedOn" IS NULL
  AND "canceledOn" IS NOT NULL
  AND "canceledOn" >= "issueDate";

UPDATE "equity_convertibles" AS convertible
SET "closedOn" = certificate."issueDate"
FROM "equity_certificates" AS certificate
WHERE convertible."status" = 'converted'
  AND convertible."closedOn" IS NULL
  AND certificate."id" = convertible."convertedToId"
  AND certificate."spaceId" = convertible."spaceId"
  AND certificate."userId" = convertible."userId"
  AND certificate."issueDate" >= convertible."issueDate";

ALTER TABLE "equity_convertibles"
  ADD CONSTRAINT "equity_convertibles_closedOn_issueDate_check"
  CHECK ("closedOn" IS NULL OR "closedOn" >= "issueDate");
