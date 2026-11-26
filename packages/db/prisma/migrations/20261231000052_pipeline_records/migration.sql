-- The fundraising pipeline moves from contact columns to records: a record is one row, linked to zero
-- or more contacts. The old contact columns stay, frozen, until a later release drops them.

CREATE TABLE "pipeline_records" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL DEFAULT 'fundraising',
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_reached',
    "statusBeforePassed" TEXT,
    "interest" TEXT,
    "referredByContactId" TEXT,
    "amountCents" BIGINT,
    "nextStep" TEXT,
    "nextCallAt" TIMESTAMP(3),
    "nextCallHasTime" BOOLEAN NOT NULL DEFAULT false,
    "waitingSince" TIMESTAMP(3),
    "roundId" TEXT,
    "details" JSONB NOT NULL DEFAULT '[]',
    "group" TEXT,
    "listOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipeline_record_people" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL DEFAULT 'fundraising',
    "recordId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_record_people_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipeline_events" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'user',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipeline_imports" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL DEFAULT 'fundraising',
    "rows" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'staging',
    "cardMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_imports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pipeline_records_spaceId_userId_pipeline_normalizedName_key" ON "pipeline_records"("spaceId", "userId", "pipeline", "normalizedName");
CREATE UNIQUE INDEX "pipeline_records_id_spaceId_userId_pipeline_key" ON "pipeline_records"("id", "spaceId", "userId", "pipeline");
CREATE UNIQUE INDEX "pipeline_records_id_spaceId_userId_key" ON "pipeline_records"("id", "spaceId", "userId");
CREATE INDEX "pipeline_records_roundId_idx" ON "pipeline_records"("roundId");
CREATE INDEX "pipeline_records_referredByContactId_idx" ON "pipeline_records"("referredByContactId");
CREATE UNIQUE INDEX "pipeline_record_people_spaceId_userId_pipeline_contactId_key" ON "pipeline_record_people"("spaceId", "userId", "pipeline", "contactId");
CREATE INDEX "pipeline_record_people_recordId_idx" ON "pipeline_record_people"("recordId");
-- At most one primary person per record.
CREATE UNIQUE INDEX "pipeline_record_people_one_primary_key" ON "pipeline_record_people"("recordId") WHERE "isPrimary";
CREATE INDEX "pipeline_events_recordId_at_idx" ON "pipeline_events"("recordId", "at");
CREATE INDEX "pipeline_imports_spaceId_userId_idx" ON "pipeline_imports"("spaceId", "userId");

ALTER TABLE "pipeline_records" ADD CONSTRAINT "pipeline_records_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_records" ADD CONSTRAINT "pipeline_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_records" ADD CONSTRAINT "pipeline_records_referredByContactId_spaceId_userId_fkey"
  FOREIGN KEY ("referredByContactId", "spaceId", "userId") REFERENCES "contacts"("id", "spaceId", "userId") ON DELETE SET NULL ("referredByContactId") ON UPDATE CASCADE;
ALTER TABLE "pipeline_records" ADD CONSTRAINT "pipeline_records_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "fundraise_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pipeline_record_people" ADD CONSTRAINT "pipeline_record_people_recordId_spaceId_userId_pipeline_fkey"
  FOREIGN KEY ("recordId", "spaceId", "userId", "pipeline") REFERENCES "pipeline_records"("id", "spaceId", "userId", "pipeline") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_record_people" ADD CONSTRAINT "pipeline_record_people_contactId_spaceId_userId_fkey"
  FOREIGN KEY ("contactId", "spaceId", "userId") REFERENCES "contacts"("id", "spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_recordId_spaceId_userId_fkey"
  FOREIGN KEY ("recordId", "spaceId", "userId") REFERENCES "pipeline_records"("id", "spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_imports" ADD CONSTRAINT "pipeline_imports_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_imports" ADD CONSTRAINT "pipeline_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for contacts.
DO $$
DECLARE
  protected text;
BEGIN
  FOREACH protected IN ARRAY ARRAY['pipeline_records', 'pipeline_record_people', 'pipeline_events', 'pipeline_imports'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("spaceId" = NULLIF(current_setting(''app.space_id'', true), ''''))',
      protected || '_tenant', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.rls_bypass'', true) = ''on'')',
      protected || '_system', protected);
  END LOOP;
END $$;

-- The first status of each stage's group.
CREATE FUNCTION "pipeline_first_status"(stage text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE stage
    WHEN 'intro' THEN 'intro_requested'
    WHEN 'meeting' THEN 'meeting_booked'
    WHEN 'diligence' THEN 'diligence'
    WHEN 'committed' THEN 'committed'
    WHEN 'passed' THEN 'passed'
    ELSE 'not_reached'
  END
$fn$;

-- One record for one prospect, from its old columns.
CREATE FUNCTION "pipeline_record_from_contact"(c "contacts") RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  base text;
  org text;
  record_name text;
  record_key text;
  stored_status text;
  is_wave boolean;
  record_id text := 'plr_' || c."id";
BEGIN
  org := NULLIF(btrim(COALESCE(c."organization", '')), '');
  base := COALESCE(org, c."name");
  record_name := base;
  record_key := lower(regexp_replace(base, '[^[:alnum:]]+', '', 'g'));
  -- Two prospects at one firm stay two records, so totals do not move; the name stays unique.
  IF record_key = '' OR EXISTS (
    SELECT 1 FROM "pipeline_records" r
    WHERE r."spaceId" = c."spaceId" AND r."userId" = c."userId"
      AND r."pipeline" = 'fundraising' AND r."normalizedName" = record_key
  ) THEN
    record_name := CASE WHEN org IS NULL OR lower(c."name") = lower(org) THEN base ELSE c."name" || ', ' || org END;
    record_key := lower(regexp_replace(record_name, '[^[:alnum:]]+', '', 'g'));
    IF record_key = '' OR record_name = base OR EXISTS (
      SELECT 1 FROM "pipeline_records" r
      WHERE r."spaceId" = c."spaceId" AND r."userId" = c."userId"
        AND r."pipeline" = 'fundraising' AND r."normalizedName" = record_key
    ) THEN
      record_key := record_key || ':' || c."id";
    END IF;
  END IF;
  stored_status := "pipeline_first_status"(c."stage");
  -- A "Wave 2" next step is a list's priority tier, not a next step.
  is_wave := COALESCE(c."nextStep", '') ~* '^\s*wave\s+\S+\s*$';
  -- A concurrent save can take the name after the check above; the id then keeps it unique.
  FOR attempt IN 1..2 LOOP
    INSERT INTO "pipeline_records" (
      "id", "spaceId", "userId", "pipeline", "name", "normalizedName", "status", "interest",
      "amountCents", "nextStep", "waitingSince", "roundId", "group", "createdAt", "updatedAt"
    ) VALUES (
      record_id, c."spaceId", c."userId", 'fundraising', record_name, record_key, stored_status,
      CASE stored_status WHEN 'committed' THEN 'in' WHEN 'passed' THEN 'out' END,
      c."checkSizeCents", CASE WHEN is_wave THEN NULL ELSE c."nextStep" END, c."mercurySentAt", c."roundId",
      CASE WHEN is_wave THEN btrim(c."nextStep") END,
      -- The contact's date, so a SAFE with no round created since then still counts as after the record.
      c."createdAt", CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
    EXIT WHEN FOUND;
    record_key := record_key || ':' || c."id";
  END LOOP;
  INSERT INTO "pipeline_record_people" ("id", "spaceId", "userId", "pipeline", "recordId", "contactId", "isPrimary")
  VALUES ('plp_' || c."id", c."spaceId", c."userId", 'fundraising', record_id, c."id", true)
  ON CONFLICT DO NOTHING;
  -- The notes also stay on the contact.
  IF NULLIF(btrim(COALESCE(c."notes", '')), '') IS NOT NULL THEN
    INSERT INTO "pipeline_events" ("id", "spaceId", "userId", "recordId", "kind", "at", "payload")
    VALUES ('ple_' || c."id", c."spaceId", c."userId", record_id, 'note', c."updatedAt", jsonb_build_object('text', c."notes"))
    ON CONFLICT DO NOTHING;
  END IF;
END $fn$;

-- backfill:start
-- One record per prospect. Safe to run again: a prospect already on a record is skipped.
DO $backfill$
DECLARE
  c "contacts";
BEGIN
  FOR c IN
    SELECT * FROM "contacts" k
    WHERE k."kind" = 'prospect'
      AND NOT EXISTS (
        SELECT 1 FROM "pipeline_record_people" p
        WHERE p."contactId" = k."id" AND p."pipeline" = 'fundraising'
      )
    ORDER BY k."createdAt", k."id"
  LOOP
    PERFORM "pipeline_record_from_contact"(c);
  END LOOP;
END $backfill$;
-- backfill:end

-- Transition only, dropped with the old columns: an API process still on the old code during a
-- rolling deploy writes those columns after the backfill. New code never writes them, so these
-- triggers fire only for old code, and carry just the columns that write changed to the record.
CREATE FUNCTION "pipeline_record_follow_contact"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  cur "pipeline_records";
  next_status text;
BEGIN
  SELECT r.* INTO cur FROM "pipeline_record_people" p
  JOIN "pipeline_records" r ON r."id" = p."recordId"
  WHERE p."contactId" = NEW."id" AND p."pipeline" = 'fundraising';
  IF NOT FOUND THEN
    IF NEW."kind" = 'prospect' THEN
      PERFORM "pipeline_record_from_contact"(NEW);
    END IF;
    RETURN NULL;
  END IF;
  next_status := cur."status";
  -- A stage keeps the current status when it is already in that stage.
  IF NEW."stage" IS DISTINCT FROM OLD."stage"
    AND "pipeline_first_status"(NEW."stage") <> (CASE cur."status"
      WHEN 'intro_made' THEN 'intro_requested' WHEN 'met' THEN 'meeting_booked' ELSE cur."status" END)
  THEN
    next_status := "pipeline_first_status"(NEW."stage");
  END IF;
  UPDATE "pipeline_records" SET
    "status" = next_status,
    "interest" = CASE
      WHEN next_status = cur."status" THEN cur."interest"
      WHEN next_status = 'committed' THEN 'in'
      WHEN next_status = 'passed' THEN 'out'
      WHEN cur."status" = 'passed' AND cur."interest" = 'out' THEN NULL
      ELSE cur."interest" END,
    "statusBeforePassed" = CASE
      WHEN next_status = cur."status" THEN cur."statusBeforePassed"
      WHEN next_status = 'passed' THEN cur."status"
      ELSE NULL END,
    "amountCents" = CASE WHEN NEW."checkSizeCents" IS DISTINCT FROM OLD."checkSizeCents"
      THEN NEW."checkSizeCents" ELSE cur."amountCents" END,
    "nextStep" = CASE WHEN NEW."nextStep" IS DISTINCT FROM OLD."nextStep"
      THEN NEW."nextStep" ELSE cur."nextStep" END,
    -- Leaving Committed leaves the round, even where the old column never held it.
    "roundId" = CASE
      WHEN next_status <> cur."status" AND next_status <> 'committed' THEN NULL
      WHEN NEW."roundId" IS DISTINCT FROM OLD."roundId" THEN NEW."roundId"
      ELSE cur."roundId" END,
    "waitingSince" = CASE WHEN NEW."mercurySentAt" IS DISTINCT FROM OLD."mercurySentAt"
      THEN NEW."mercurySentAt" ELSE cur."waitingSince" END,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = cur."id";
  RETURN NULL;
END $fn$;

CREATE TRIGGER "contacts_old_columns_insert" AFTER INSERT ON "contacts"
  FOR EACH ROW WHEN (
    NEW."stage" IS NOT NULL OR NEW."checkSizeCents" IS NOT NULL OR NEW."nextStep" IS NOT NULL
    OR NEW."roundId" IS NOT NULL OR NEW."mercurySentAt" IS NOT NULL
  )
  EXECUTE FUNCTION "pipeline_record_follow_contact"();

CREATE TRIGGER "contacts_old_columns_update"
  AFTER UPDATE OF "stage", "checkSizeCents", "nextStep", "roundId", "mercurySentAt" ON "contacts"
  FOR EACH ROW WHEN (
    NEW."stage" IS DISTINCT FROM OLD."stage"
    OR NEW."checkSizeCents" IS DISTINCT FROM OLD."checkSizeCents"
    OR NEW."nextStep" IS DISTINCT FROM OLD."nextStep"
    OR NEW."roundId" IS DISTINCT FROM OLD."roundId"
    OR NEW."mercurySentAt" IS DISTINCT FROM OLD."mercurySentAt"
  )
  EXECUTE FUNCTION "pipeline_record_follow_contact"();
