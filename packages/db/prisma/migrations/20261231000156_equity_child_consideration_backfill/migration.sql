-- Data only: no schema change, so prisma migrate diff is unaffected.
--
-- Before the as-of rebuild, a certificate made by a transfer, split, partial cancel or class
-- conversion kept zero consideration and the closed parent kept all of it. Cash raised per holder
-- and class is now counted from the certificates outstanding on a date, so those children must
-- carry their share. Each field of the parent's consideration is split over its children (and over
-- the shares that were canceled, which are no certificate) by share fraction, with exact integer
-- arithmetic and largest remainder, so the cents of every field add up to the parent's exactly.
--
-- Idempotent: only a closed parent whose children all have zero consideration is touched, and
-- after the run the children carry it. A chain (A transferred to B, B to C) needs one pass per
-- generation, because B only has consideration to hand on once A's pass has run, so the statement
-- repeats until a pass changes nothing. A pass only counts rows whose values change, which ends
-- the loop even when a tiny amount rounds to zero for every child.
-- Prisma cannot express data backfills; see docs/cap-table/EXTENDING.md.

DO $backfill$
DECLARE changed bigint;
BEGIN
LOOP
WITH eligible AS (
  SELECT parent."id" AS parent_id, parent."quantity" AS parent_qty,
         parent."cashPaidCents", parent."debtCanceledCents",
         parent."ipTransferredCents", parent."otherConsiderationCents"
  FROM "equity_certificates" AS parent
  WHERE parent."status" IN ('transferred', 'converted', 'canceled', 'repurchased')
    AND parent."quantity" > 0
    AND (parent."cashPaidCents" > 0 OR parent."debtCanceledCents" > 0
         OR parent."ipTransferredCents" > 0 OR parent."otherConsiderationCents" > 0)
    AND EXISTS (
      SELECT 1 FROM "equity_certificates" AS child
      WHERE child."parentId" = parent."id"
        AND child."spaceId" = parent."spaceId" AND child."userId" = parent."userId"
    )
    AND NOT EXISTS (
      SELECT 1 FROM "equity_certificates" AS child
      WHERE child."parentId" = parent."id"
        AND child."spaceId" = parent."spaceId" AND child."userId" = parent."userId"
        AND (child."cashPaidCents" <> 0 OR child."debtCanceledCents" <> 0
             OR child."ipTransferredCents" <> 0 OR child."otherConsiderationCents" <> 0)
    )
),
children AS (
  SELECT eligible.parent_id, child."id" AS child_id, child."quantity" AS qty
  FROM eligible
  JOIN "equity_certificates" AS child ON child."parentId" = eligible.parent_id
),
-- A part with no certificate stands for the shares of the parent that were canceled.
parts AS (
  SELECT parent_id, child_id, qty FROM children
  UNION ALL
  SELECT eligible.parent_id, NULL, eligible.parent_qty - sum(children.qty)
  FROM eligible JOIN children USING (parent_id)
  GROUP BY eligible.parent_id, eligible.parent_qty
  HAVING eligible.parent_qty - sum(children.qty) > 0
),
fields AS (
  SELECT eligible.parent_id, eligible.parent_qty, field.name, field.total
  FROM eligible
  CROSS JOIN LATERAL (VALUES
    ('cash', eligible."cashPaidCents"),
    ('debt', eligible."debtCanceledCents"),
    ('ip', eligible."ipTransferredCents"),
    ('other', eligible."otherConsiderationCents")
  ) AS field(name, total)
  WHERE field.total > 0
),
floors AS (
  SELECT fields.parent_id, fields.name, fields.total, parts.child_id,
         floor(fields.total::numeric * parts.qty / fields.parent_qty) AS base,
         (fields.total::numeric * parts.qty) % fields.parent_qty AS remainder
  FROM fields JOIN parts USING (parent_id)
),
ranked AS (
  SELECT floors.*,
         floors.total - sum(floors.base) OVER (PARTITION BY parent_id, name) AS leftover,
         row_number() OVER (
           PARTITION BY parent_id, name ORDER BY remainder DESC, child_id NULLS LAST
         ) AS place
  FROM floors
),
allocation AS (
  SELECT child_id,
         sum(base + CASE WHEN place <= leftover THEN 1 ELSE 0 END) FILTER (WHERE name = 'cash') AS cash,
         sum(base + CASE WHEN place <= leftover THEN 1 ELSE 0 END) FILTER (WHERE name = 'debt') AS debt,
         sum(base + CASE WHEN place <= leftover THEN 1 ELSE 0 END) FILTER (WHERE name = 'ip') AS ip,
         sum(base + CASE WHEN place <= leftover THEN 1 ELSE 0 END) FILTER (WHERE name = 'other') AS other
  FROM ranked
  WHERE child_id IS NOT NULL
  GROUP BY child_id
)
UPDATE "equity_certificates" AS certificate
SET "cashPaidCents" = COALESCE(allocation.cash, 0)::bigint,
    "debtCanceledCents" = COALESCE(allocation.debt, 0)::bigint,
    "ipTransferredCents" = COALESCE(allocation.ip, 0)::bigint,
    "otherConsiderationCents" = COALESCE(allocation.other, 0)::bigint
FROM allocation
WHERE certificate."id" = allocation.child_id
  AND (certificate."cashPaidCents", certificate."debtCanceledCents",
       certificate."ipTransferredCents", certificate."otherConsiderationCents")
      IS DISTINCT FROM (COALESCE(allocation.cash, 0), COALESCE(allocation.debt, 0),
                        COALESCE(allocation.ip, 0), COALESCE(allocation.other, 0));
GET DIAGNOSTICS changed = ROW_COUNT;
EXIT WHEN changed = 0;
END LOOP;
END
$backfill$;
