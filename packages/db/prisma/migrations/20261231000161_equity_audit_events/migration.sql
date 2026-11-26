-- Prisma cannot express the trigger below, so schema.prisma does not describe it. See
-- docs/cap-table/EXTENDING.md ("Migration forms Prisma cannot express").
-- Append-only history of cap table changes that are not securities transactions. The actor is a
-- user id with no foreign key, so the row outlives the user record.
CREATE TABLE "equity_audit_events" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equity_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "equity_audit_events_spaceId_userId_at_idx" ON "equity_audit_events"("spaceId", "userId", "at");
CREATE INDEX "equity_audit_events_spaceId_userId_subjectType_subjectId_idx"
  ON "equity_audit_events"("spaceId", "userId", "subjectType", "subjectId");
ALTER TABLE "equity_audit_events" ADD CONSTRAINT "equity_audit_events_spaceId_userId_fkey"
  FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security as for equity_transactions: the tenant reads and inserts, never updates or
-- deletes; the system bypass keeps full access.
ALTER TABLE "equity_audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equity_audit_events_tenant" ON "equity_audit_events" FOR SELECT
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "equity_audit_events_tenant_insert" ON "equity_audit_events" FOR INSERT
  WITH CHECK ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "equity_audit_events_system" ON "equity_audit_events"
  USING (current_setting('app.rls_bypass', true) = 'on');

-- The policies do not bind the table owner or the system bypass, so a trigger enforces append-only
-- for every role. A delete is allowed only when its ledger is already gone: the foreign key
-- cascade runs after the ledger row is deleted, while a direct delete finds the ledger present.
CREATE FUNCTION "equity_audit_events_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM "equity_ledgers" WHERE "spaceId" = OLD."spaceId" AND "userId" = OLD."userId"
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'equity_audit_events is append-only' USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER "equity_audit_events_append_only" BEFORE UPDATE OR DELETE ON "equity_audit_events"
  FOR EACH ROW EXECUTE FUNCTION "equity_audit_events_append_only"();
