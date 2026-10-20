CREATE FUNCTION company_has_forbidden_attribute_key(value JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE jsonb_typeof(value)
    WHEN 'object' THEN EXISTS (
      SELECT 1
      FROM jsonb_each(value) AS entry(key, value)
      WHERE lower(entry.key) ~ '(compensation|health|performance|immigration|home.?address|personal.?phone)'
         OR company_has_forbidden_attribute_key(entry.value)
    )
    WHEN 'array' THEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(value) AS entry(value)
      WHERE company_has_forbidden_attribute_key(entry.value)
    )
    ELSE FALSE
  END
$$;

CREATE TABLE "company_entities" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "attrs" JSONB NOT NULL DEFAULT '{}',
  "confidence" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'suggested',
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "lockedFields" TEXT[] NOT NULL DEFAULT '{}',
  "confirmedAt" TIMESTAMP(3),
  "confirmedByUserId" TEXT,
  "contactId" TEXT,
  "legalContractId" TEXT,
  "dataRoomItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_entities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_entities_kind_check" CHECK ("kind" IN ('company', 'person', 'organisation', 'matter', 'project', 'product')),
  CONSTRAINT "company_entities_status_check" CHECK ("status" IN ('suggested', 'confirmed', 'rejected')),
  CONSTRAINT "company_entities_visibility_check" CHECK ("visibility" IN ('private', 'team')),
  CONSTRAINT "company_entities_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "company_entities_attrs_check" CHECK (
    jsonb_typeof("attrs") = 'object'
    AND NOT company_has_forbidden_attribute_key("attrs")
  ),
  CONSTRAINT "company_entities_confirmation_check" CHECK (
    ("status" = 'confirmed') = ("confirmedAt" IS NOT NULL)
  )
);

CREATE TABLE "company_identities" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityKind" TEXT NOT NULL,
  "identityType" TEXT NOT NULL,
  "identityValue" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_edges" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "fromId" TEXT NOT NULL,
  "toId" TEXT NOT NULL,
  "relation" TEXT NOT NULL,
  "startsOn" DATE,
  "startsPrecision" TEXT,
  "endsOn" DATE,
  "endsPrecision" TEXT,
  "role" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'suggested',
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "lockedFields" TEXT[] NOT NULL DEFAULT '{}',
  "confirmedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_edges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_edges_relation_check" CHECK ("relation" IN ('works_at', 'reports_to', 'founded', 'invested_in', 'customer_of', 'vendor_of', 'counsel_for', 'party_to', 'works_on', 'part_of')),
  CONSTRAINT "company_edges_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "company_edges_status_check" CHECK ("status" IN ('suggested', 'confirmed', 'rejected')),
  CONSTRAINT "company_edges_visibility_check" CHECK ("visibility" IN ('private', 'team')),
  CONSTRAINT "company_edges_confirmation_check" CHECK (("status" = 'confirmed') = ("confirmedAt" IS NOT NULL)),
  CONSTRAINT "company_edges_start_precision_check" CHECK (
    ("startsOn" IS NULL) = ("startsPrecision" IS NULL)
    AND ("startsPrecision" IS NULL OR "startsPrecision" IN ('day', 'month', 'quarter', 'year'))
    AND (
      "startsOn" IS NULL
      OR "startsPrecision" = 'day'
      OR ("startsPrecision" = 'month' AND EXTRACT(DAY FROM "startsOn") = 1)
      OR ("startsPrecision" = 'quarter' AND EXTRACT(DAY FROM "startsOn") = 1 AND EXTRACT(MONTH FROM "startsOn") IN (1, 4, 7, 10))
      OR ("startsPrecision" = 'year' AND EXTRACT(MONTH FROM "startsOn") = 1 AND EXTRACT(DAY FROM "startsOn") = 1)
    )
  ),
  CONSTRAINT "company_edges_end_precision_check" CHECK (
    ("endsOn" IS NULL) = ("endsPrecision" IS NULL)
    AND ("endsPrecision" IS NULL OR "endsPrecision" IN ('day', 'month', 'quarter', 'year'))
    AND (
      "endsOn" IS NULL
      OR "endsPrecision" = 'day'
      OR ("endsPrecision" = 'month' AND EXTRACT(DAY FROM "endsOn") = 1)
      OR ("endsPrecision" = 'quarter' AND EXTRACT(DAY FROM "endsOn") = 1 AND EXTRACT(MONTH FROM "endsOn") IN (1, 4, 7, 10))
      OR ("endsPrecision" = 'year' AND EXTRACT(MONTH FROM "endsOn") = 1 AND EXTRACT(DAY FROM "endsOn") = 1)
    )
  ),
  CONSTRAINT "company_edges_period_check" CHECK ("startsOn" IS NULL OR "endsOn" IS NULL OR "startsOn" <= "endsOn")
);

CREATE TABLE "company_events" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "stream" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "occursOn" DATE,
  "occursPrecision" TEXT,
  "endsOn" DATE,
  "endsPrecision" TEXT,
  "amountCents" BIGINT,
  "currency" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'suggested',
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "lockedFields" TEXT[] NOT NULL DEFAULT '{}',
  "confirmedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_events_stream_check" CHECK ("stream" IN ('company', 'people', 'funding', 'legal', 'product', 'customers')),
  CONSTRAINT "company_events_kind_check" CHECK ("kind" IN ('founded', 'hire', 'departure', 'role_change', 'funding_round', 'contract_signed', 'renewal', 'matter_opened', 'matter_closed', 'launch', 'customer_won', 'customer_lost', 'milestone', 'other')),
  CONSTRAINT "company_events_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "company_events_status_check" CHECK ("status" IN ('suggested', 'confirmed', 'rejected')),
  CONSTRAINT "company_events_visibility_check" CHECK ("visibility" IN ('private', 'team')),
  CONSTRAINT "company_events_confirmation_check" CHECK (("status" = 'confirmed') = ("confirmedAt" IS NOT NULL)),
  CONSTRAINT "company_events_occurs_precision_check" CHECK (
    ("occursOn" IS NULL) = ("occursPrecision" IS NULL)
    AND (
      "occursPrecision" IS NULL
      OR "occursPrecision" IN ('day', 'month', 'quarter', 'year')
    )
    AND (
      "occursOn" IS NULL
      OR
      "occursPrecision" = 'day'
      OR ("occursPrecision" = 'month' AND EXTRACT(DAY FROM "occursOn") = 1)
      OR ("occursPrecision" = 'quarter' AND EXTRACT(DAY FROM "occursOn") = 1 AND EXTRACT(MONTH FROM "occursOn") IN (1, 4, 7, 10))
      OR ("occursPrecision" = 'year' AND EXTRACT(MONTH FROM "occursOn") = 1 AND EXTRACT(DAY FROM "occursOn") = 1)
    )
  ),
  CONSTRAINT "company_events_end_precision_check" CHECK (
    ("endsOn" IS NULL) = ("endsPrecision" IS NULL)
    AND ("endsPrecision" IS NULL OR "endsPrecision" IN ('day', 'month', 'quarter', 'year'))
    AND (
      "endsOn" IS NULL
      OR "endsPrecision" = 'day'
      OR ("endsPrecision" = 'month' AND EXTRACT(DAY FROM "endsOn") = 1)
      OR ("endsPrecision" = 'quarter' AND EXTRACT(DAY FROM "endsOn") = 1 AND EXTRACT(MONTH FROM "endsOn") IN (1, 4, 7, 10))
      OR ("endsPrecision" = 'year' AND EXTRACT(MONTH FROM "endsOn") = 1 AND EXTRACT(DAY FROM "endsOn") = 1)
    )
  ),
  CONSTRAINT "company_events_period_check" CHECK ("endsOn" IS NULL OR "occursOn" <= "endsOn"),
  CONSTRAINT "company_events_amount_check" CHECK (("amountCents" IS NULL) = ("currency" IS NULL))
);

CREATE TABLE "company_event_entities" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  CONSTRAINT "company_event_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_evidence" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "factKind" TEXT NOT NULL,
  "factId" TEXT NOT NULL,
  "stance" TEXT NOT NULL DEFAULT 'supports',
  "sourceKind" TEXT NOT NULL,
  "connectionId" TEXT,
  "mcpServerId" TEXT,
  "dataRoomItemId" TEXT,
  "sourceItemId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "quote" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "extractedAt" TIMESTAMP(3) NOT NULL,
  "extractorRunId" TEXT,
  "extractorModel" JSONB,
  "confidence" DOUBLE PRECISION NOT NULL,
  "confirmedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_evidence_fact_kind_check" CHECK ("factKind" IN ('entity', 'edge', 'event')),
  CONSTRAINT "company_evidence_stance_check" CHECK ("stance" IN ('supports', 'contradicts')),
  CONSTRAINT "company_evidence_source_kind_check" CHECK ("sourceKind" IN ('gmail', 'data_room', 'slack', 'github', 'linear', 'notion', 'mcp', 'composio', 'manual')),
  CONSTRAINT "company_evidence_quote_check" CHECK (char_length("quote") BETWEEN 1 AND 240),
  CONSTRAINT "company_evidence_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "company_evidence_model_check" CHECK (
    "extractorModel" IS NULL OR jsonb_typeof("extractorModel") IN ('object', 'null')
  ),
  CONSTRAINT "company_evidence_source_link_check" CHECK (
    ("connectionId" IS NULL OR "mcpServerId" IS NULL)
    AND ("sourceKind" <> 'mcp' OR "mcpServerId" IS NOT NULL OR "connectionId" IS NOT NULL)
  )
);

CREATE TABLE "company_candidates" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "entityIds" TEXT[] NOT NULL DEFAULT '{}',
  "proposedFact" JSONB NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "connectionId" TEXT,
  "mcpServerId" TEXT,
  "dataRoomItemId" TEXT,
  "sourceItemId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "quote" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_candidates_quote_check" CHECK (char_length("quote") BETWEEN 1 AND 240)
);

CREATE TABLE "company_corrections" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_corrections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_rejections" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "factKind" TEXT NOT NULL DEFAULT 'entity',
  "entityKind" TEXT,
  "fingerprint" TEXT NOT NULL,
  "identityAliases" TEXT[] NOT NULL DEFAULT '{}',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_rejections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_merges" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "survivorEntityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_merges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_merges_not_self_check" CHECK ("sourceEntityId" <> "survivorEntityId")
);

CREATE UNIQUE INDEX "company_entities_id_spaceId_ownerUserId_key" ON "company_entities"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_entities_one_company_key" ON "company_entities"("spaceId", "ownerUserId") WHERE "kind" = 'company';
CREATE INDEX "company_entities_spaceId_ownerUserId_kind_status_idx" ON "company_entities"("spaceId", "ownerUserId", "kind", "status");
CREATE INDEX "company_entities_spaceId_ownerUserId_normalizedName_idx" ON "company_entities"("spaceId", "ownerUserId", "normalizedName");

CREATE UNIQUE INDEX "company_identities_id_spaceId_ownerUserId_key" ON "company_identities"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_identities_scoped_identity_key" ON "company_identities"("spaceId", "ownerUserId", "entityKind", "identityType", "identityValue");
CREATE INDEX "company_identities_entityId_spaceId_ownerUserId_idx" ON "company_identities"("entityId", "spaceId", "ownerUserId");

CREATE UNIQUE INDEX "company_edges_id_spaceId_ownerUserId_key" ON "company_edges"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_edges_period_key" ON "company_edges"(
  "spaceId", "ownerUserId", "fromId", "toId", "relation",
  COALESCE("startsOn", DATE '0001-01-01'), COALESCE("startsPrecision", ''),
  COALESCE("endsOn", DATE '9999-12-31'), COALESCE("endsPrecision", ''),
  COALESCE("role", '')
);
CREATE INDEX "company_edges_spaceId_ownerUserId_fromId_idx" ON "company_edges"("spaceId", "ownerUserId", "fromId");
CREATE INDEX "company_edges_spaceId_ownerUserId_toId_idx" ON "company_edges"("spaceId", "ownerUserId", "toId");

CREATE UNIQUE INDEX "company_events_id_spaceId_ownerUserId_key" ON "company_events"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_events_fingerprint_key" ON "company_events"(
  "spaceId", "ownerUserId", "kind", "normalizedTitle",
  COALESCE("occursOn", DATE '0001-01-01'), COALESCE("occursPrecision", '')
);
CREATE INDEX "company_events_spaceId_ownerUserId_occursOn_idx" ON "company_events"("spaceId", "ownerUserId", "occursOn");

CREATE UNIQUE INDEX "company_event_entities_id_spaceId_ownerUserId_key" ON "company_event_entities"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_event_entities_eventId_entityId_key" ON "company_event_entities"("eventId", "entityId");

CREATE UNIQUE INDEX "company_evidence_id_spaceId_ownerUserId_key" ON "company_evidence"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_evidence_fact_source_hash_key" ON "company_evidence"(
  "spaceId", "ownerUserId", "factKind", "factId", "sourceKey", "contentHash"
);
CREATE INDEX "company_evidence_spaceId_ownerUserId_sourceKind_sourceItemId_idx" ON "company_evidence"("spaceId", "ownerUserId", "sourceKind", "sourceItemId");
CREATE INDEX "company_evidence_fact_scope_idx" ON "company_evidence"("factKind", "factId", "spaceId", "ownerUserId");

CREATE UNIQUE INDEX "company_candidates_id_spaceId_ownerUserId_key" ON "company_candidates"("id", "spaceId", "ownerUserId");
CREATE INDEX "company_candidates_spaceId_ownerUserId_createdAt_idx" ON "company_candidates"("spaceId", "ownerUserId", "createdAt");

CREATE UNIQUE INDEX "company_corrections_id_spaceId_ownerUserId_key" ON "company_corrections"("id", "spaceId", "ownerUserId");
CREATE INDEX "company_corrections_entity_path_idx" ON "company_corrections"("spaceId", "ownerUserId", "entityId", "fieldPath");

CREATE UNIQUE INDEX "company_rejections_id_spaceId_ownerUserId_key" ON "company_rejections"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_rejections_fingerprint_key" ON "company_rejections"("spaceId", "ownerUserId", "fingerprint");
CREATE INDEX "company_rejections_scope_idx" ON "company_rejections"("spaceId", "ownerUserId");

CREATE UNIQUE INDEX "company_merges_id_spaceId_ownerUserId_key" ON "company_merges"("id", "spaceId", "ownerUserId");
CREATE UNIQUE INDEX "company_merges_source_key" ON "company_merges"("spaceId", "ownerUserId", "sourceEntityId");
CREATE INDEX "company_merges_survivor_idx" ON "company_merges"("spaceId", "ownerUserId", "survivorEntityId");

CREATE UNIQUE INDEX "contacts_id_spaceId_userId_key" ON "contacts"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "data_room_items_id_spaceId_userId_key" ON "data_room_items"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "legal_contracts_id_spaceId_userId_key" ON "legal_contracts"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "connections_id_spaceId_userId_key" ON "connections"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "mcp_servers_id_spaceId_userId_key" ON "mcp_servers"("id", "spaceId", "userId");

ALTER TABLE "company_entities" ADD CONSTRAINT "company_entities_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_entities" ADD CONSTRAINT "company_entities_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_entities" ADD CONSTRAINT "company_entities_contact_scope_fkey"
  FOREIGN KEY ("contactId", "spaceId", "ownerUserId") REFERENCES "contacts"("id", "spaceId", "userId") ON DELETE SET NULL ("contactId") ON UPDATE CASCADE;
ALTER TABLE "company_entities" ADD CONSTRAINT "company_entities_legal_contract_scope_fkey"
  FOREIGN KEY ("legalContractId", "spaceId", "ownerUserId") REFERENCES "legal_contracts"("id", "spaceId", "userId") ON DELETE SET NULL ("legalContractId") ON UPDATE CASCADE;
ALTER TABLE "company_entities" ADD CONSTRAINT "company_entities_data_room_item_scope_fkey"
  FOREIGN KEY ("dataRoomItemId", "spaceId", "ownerUserId") REFERENCES "data_room_items"("id", "spaceId", "userId") ON DELETE SET NULL ("dataRoomItemId") ON UPDATE CASCADE;

ALTER TABLE "company_identities" ADD CONSTRAINT "company_identities_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_identities" ADD CONSTRAINT "company_identities_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_identities" ADD CONSTRAINT "company_identities_entity_scope_fkey"
  FOREIGN KEY ("entityId", "spaceId", "ownerUserId") REFERENCES "company_entities"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_edges" ADD CONSTRAINT "company_edges_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_edges" ADD CONSTRAINT "company_edges_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_edges" ADD CONSTRAINT "company_edges_from_scope_fkey"
  FOREIGN KEY ("fromId", "spaceId", "ownerUserId") REFERENCES "company_entities"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_edges" ADD CONSTRAINT "company_edges_to_scope_fkey"
  FOREIGN KEY ("toId", "spaceId", "ownerUserId") REFERENCES "company_entities"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_events" ADD CONSTRAINT "company_events_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_event_entities" ADD CONSTRAINT "company_event_entities_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_event_entities" ADD CONSTRAINT "company_event_entities_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_event_entities" ADD CONSTRAINT "company_event_entities_event_scope_fkey"
  FOREIGN KEY ("eventId", "spaceId", "ownerUserId") REFERENCES "company_events"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_event_entities" ADD CONSTRAINT "company_event_entities_entity_scope_fkey"
  FOREIGN KEY ("entityId", "spaceId", "ownerUserId") REFERENCES "company_entities"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_evidence" ADD CONSTRAINT "company_evidence_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_evidence" ADD CONSTRAINT "company_evidence_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_evidence" ADD CONSTRAINT "company_evidence_connection_scope_fkey"
  FOREIGN KEY ("connectionId", "spaceId", "ownerUserId") REFERENCES "connections"("id", "spaceId", "userId") ON DELETE SET NULL ("connectionId") ON UPDATE CASCADE;
ALTER TABLE "company_evidence" ADD CONSTRAINT "company_evidence_mcp_scope_fkey"
  FOREIGN KEY ("mcpServerId", "spaceId", "ownerUserId") REFERENCES "mcp_servers"("id", "spaceId", "userId") ON DELETE SET NULL ("mcpServerId") ON UPDATE CASCADE;
ALTER TABLE "company_evidence" ADD CONSTRAINT "company_evidence_data_room_item_scope_fkey"
  FOREIGN KEY ("dataRoomItemId", "spaceId", "ownerUserId") REFERENCES "data_room_items"("id", "spaceId", "userId") ON DELETE SET NULL ("dataRoomItemId") ON UPDATE CASCADE;

ALTER TABLE "company_candidates" ADD CONSTRAINT "company_candidates_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_candidates" ADD CONSTRAINT "company_candidates_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_candidates" ADD CONSTRAINT "company_candidates_connection_scope_fkey"
  FOREIGN KEY ("connectionId", "spaceId", "ownerUserId") REFERENCES "connections"("id", "spaceId", "userId") ON DELETE SET NULL ("connectionId") ON UPDATE CASCADE;
ALTER TABLE "company_candidates" ADD CONSTRAINT "company_candidates_mcp_scope_fkey"
  FOREIGN KEY ("mcpServerId", "spaceId", "ownerUserId") REFERENCES "mcp_servers"("id", "spaceId", "userId") ON DELETE SET NULL ("mcpServerId") ON UPDATE CASCADE;
ALTER TABLE "company_candidates" ADD CONSTRAINT "company_candidates_data_room_item_scope_fkey"
  FOREIGN KEY ("dataRoomItemId", "spaceId", "ownerUserId") REFERENCES "data_room_items"("id", "spaceId", "userId") ON DELETE SET NULL ("dataRoomItemId") ON UPDATE CASCADE;

ALTER TABLE "company_corrections" ADD CONSTRAINT "company_corrections_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_corrections" ADD CONSTRAINT "company_corrections_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_corrections" ADD CONSTRAINT "company_corrections_entity_scope_fkey"
  FOREIGN KEY ("entityId", "spaceId", "ownerUserId") REFERENCES "company_entities"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_rejections" ADD CONSTRAINT "company_rejections_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_rejections" ADD CONSTRAINT "company_rejections_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_merges" ADD CONSTRAINT "company_merges_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_merges" ADD CONSTRAINT "company_merges_owner_fkey"
  FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_merges" ADD CONSTRAINT "company_merges_source_scope_fkey"
  FOREIGN KEY ("sourceEntityId", "spaceId", "ownerUserId") REFERENCES "company_entities"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_merges" ADD CONSTRAINT "company_merges_survivor_scope_fkey"
  FOREIGN KEY ("survivorEntityId", "spaceId", "ownerUserId") REFERENCES "company_entities"("id", "spaceId", "ownerUserId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION company_validate_merge()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  source_kind TEXT;
  survivor_kind TEXT;
BEGIN
  SELECT "kind" INTO source_kind
  FROM "company_entities"
  WHERE "id" = NEW."sourceEntityId" AND "spaceId" = NEW."spaceId" AND "ownerUserId" = NEW."ownerUserId";
  SELECT "kind" INTO survivor_kind
  FROM "company_entities"
  WHERE "id" = NEW."survivorEntityId" AND "spaceId" = NEW."spaceId" AND "ownerUserId" = NEW."ownerUserId";
  IF source_kind IS DISTINCT FROM survivor_kind THEN
    RAISE EXCEPTION 'company merges require matching entity kinds'
      USING ERRCODE = '23514', CONSTRAINT = 'company_merge_kind_check';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "company_merges"
    WHERE "spaceId" = NEW."spaceId" AND "ownerUserId" = NEW."ownerUserId"
      AND ("sourceEntityId" = NEW."survivorEntityId" OR "survivorEntityId" = NEW."sourceEntityId")
      AND "id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION 'company merge chains and cycles are not allowed'
      USING ERRCODE = '23514', CONSTRAINT = 'company_merge_acyclic_check';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "company_merges_validate"
BEFORE INSERT OR UPDATE ON "company_merges"
FOR EACH ROW EXECUTE FUNCTION company_validate_merge();

CREATE FUNCTION company_validate_fact_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fact_exists BOOLEAN;
BEGIN
  IF NEW."factKind" = 'entity' THEN
    SELECT EXISTS (
      SELECT 1 FROM "company_entities"
      WHERE "id" = NEW."factId" AND "spaceId" = NEW."spaceId" AND "ownerUserId" = NEW."ownerUserId"
    ) INTO fact_exists;
  ELSIF NEW."factKind" = 'edge' THEN
    SELECT EXISTS (
      SELECT 1 FROM "company_edges"
      WHERE "id" = NEW."factId" AND "spaceId" = NEW."spaceId" AND "ownerUserId" = NEW."ownerUserId"
    ) INTO fact_exists;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM "company_events"
      WHERE "id" = NEW."factId" AND "spaceId" = NEW."spaceId" AND "ownerUserId" = NEW."ownerUserId"
    ) INTO fact_exists;
  END IF;
  IF NOT fact_exists THEN
    RAISE EXCEPTION 'company evidence references a missing or out-of-scope fact'
      USING ERRCODE = '23503', CONSTRAINT = 'company_evidence_fact_scope_fkey';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION company_lock_evidence_fact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fact_table TEXT;
BEGIN
  IF NEW."factKind" = 'entity' THEN fact_table := 'company_entities';
  ELSIF NEW."factKind" = 'edge' THEN fact_table := 'company_edges';
  ELSE fact_table := 'company_events';
  END IF;
  EXECUTE format(
    'SELECT 1 FROM %I WHERE "id" = $1 AND "spaceId" = $2 AND "ownerUserId" = $3 FOR UPDATE',
    fact_table
  ) USING NEW."factId", NEW."spaceId", NEW."ownerUserId";
  RETURN NEW;
END
$$;

CREATE TRIGGER "company_evidence_lock_fact"
BEFORE INSERT OR UPDATE OF "factKind", "factId", "spaceId", "ownerUserId" ON "company_evidence"
FOR EACH ROW EXECUTE FUNCTION company_lock_evidence_fact();

CREATE TRIGGER "company_evidence_validate_fact"
BEFORE INSERT OR UPDATE OF "factKind", "factId", "spaceId", "ownerUserId" ON "company_evidence"
FOR EACH ROW EXECUTE FUNCTION company_validate_fact_reference();

CREATE FUNCTION company_fact_requires_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fact_kind TEXT;
  fact_exists BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'company_entities' THEN fact_kind := 'entity';
  ELSIF TG_TABLE_NAME = 'company_edges' THEN fact_kind := 'edge';
  ELSE fact_kind := 'event';
  END IF;
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I WHERE "id" = $1 AND "spaceId" = $2 AND "ownerUserId" = $3)',
    TG_TABLE_NAME
  ) INTO fact_exists USING NEW."id", NEW."spaceId", NEW."ownerUserId";
  IF NOT fact_exists THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "company_evidence"
    WHERE "factKind" = fact_kind
      AND "factId" = NEW."id"
      AND "spaceId" = NEW."spaceId"
      AND "ownerUserId" = NEW."ownerUserId"
  ) THEN
    RAISE EXCEPTION 'company fact must have at least one evidence row'
      USING ERRCODE = '23514', CONSTRAINT = 'company_fact_requires_evidence';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "company_entities_require_evidence"
AFTER INSERT OR UPDATE ON "company_entities"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION company_fact_requires_evidence();
CREATE CONSTRAINT TRIGGER "company_edges_require_evidence"
AFTER INSERT OR UPDATE ON "company_edges"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION company_fact_requires_evidence();
CREATE CONSTRAINT TRIGGER "company_events_require_evidence"
AFTER INSERT OR UPDATE ON "company_events"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION company_fact_requires_evidence();

CREATE FUNCTION company_remove_orphan_fact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fact_table TEXT;
BEGIN
  IF OLD."factKind" = 'entity' THEN fact_table := 'company_entities';
  ELSIF OLD."factKind" = 'edge' THEN fact_table := 'company_edges';
  ELSE fact_table := 'company_events';
  END IF;
  EXECUTE format(
    'SELECT 1 FROM %I WHERE "id" = $1 AND "spaceId" = $2 AND "ownerUserId" = $3 FOR UPDATE',
    fact_table
  ) USING OLD."factId", OLD."spaceId", OLD."ownerUserId";
  IF NOT EXISTS (
    SELECT 1 FROM "company_evidence"
    WHERE "factKind" = OLD."factKind"
      AND "factId" = OLD."factId"
      AND "spaceId" = OLD."spaceId"
      AND "ownerUserId" = OLD."ownerUserId"
  ) THEN
    EXECUTE format(
      'DELETE FROM %I WHERE "id" = $1 AND "spaceId" = $2 AND "ownerUserId" = $3',
      fact_table
    ) USING OLD."factId", OLD."spaceId", OLD."ownerUserId";
  END IF;
  RETURN NULL;
END
$$;

CREATE FUNCTION company_lock_evidence_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fact_table TEXT;
BEGIN
  IF OLD."factKind" = 'entity' THEN fact_table := 'company_entities';
  ELSIF OLD."factKind" = 'edge' THEN fact_table := 'company_edges';
  ELSE fact_table := 'company_events';
  END IF;
  EXECUTE format(
    'SELECT 1 FROM %I WHERE "id" = $1 AND "spaceId" = $2 AND "ownerUserId" = $3 FOR UPDATE',
    fact_table
  ) USING OLD."factId", OLD."spaceId", OLD."ownerUserId";
  RETURN OLD;
END
$$;

CREATE TRIGGER "company_evidence_lock_delete"
BEFORE DELETE ON "company_evidence"
FOR EACH ROW EXECUTE FUNCTION company_lock_evidence_delete();

CREATE TRIGGER "company_evidence_remove_orphan"
AFTER DELETE ON "company_evidence"
FOR EACH ROW EXECUTE FUNCTION company_remove_orphan_fact();

CREATE FUNCTION company_reject_evidence_move()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW."factKind", NEW."factId", NEW."spaceId", NEW."ownerUserId")
    IS DISTINCT FROM (OLD."factKind", OLD."factId", OLD."spaceId", OLD."ownerUserId") THEN
    RAISE EXCEPTION 'company evidence fact ownership is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'company_evidence_fact_immutable';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "company_evidence_immutable_fact"
BEFORE UPDATE ON "company_evidence"
FOR EACH ROW EXECUTE FUNCTION company_reject_evidence_move();

CREATE FUNCTION company_delete_entity_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM "company_evidence"
  WHERE "factKind" = TG_ARGV[0]
    AND "factId" = OLD."id"
    AND "spaceId" = OLD."spaceId"
    AND "ownerUserId" = OLD."ownerUserId";
  RETURN OLD;
END
$$;

CREATE TRIGGER "company_entities_delete_evidence"
AFTER DELETE ON "company_entities"
FOR EACH ROW EXECUTE FUNCTION company_delete_entity_evidence('entity');
CREATE TRIGGER "company_edges_delete_evidence"
AFTER DELETE ON "company_edges"
FOR EACH ROW EXECUTE FUNCTION company_delete_entity_evidence('edge');
CREATE TRIGGER "company_events_delete_evidence"
AFTER DELETE ON "company_events"
FOR EACH ROW EXECUTE FUNCTION company_delete_entity_evidence('event');

CREATE FUNCTION company_disconnect_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  source_kind TEXT := TG_ARGV[0];
BEGIN
  IF source_kind = 'connection' THEN
    DELETE FROM "company_evidence" WHERE "connectionId" = OLD."id";
    DELETE FROM "company_candidates" WHERE "connectionId" = OLD."id";
  ELSIF source_kind = 'mcp' THEN
    DELETE FROM "company_evidence" WHERE "mcpServerId" = OLD."id";
    DELETE FROM "company_candidates" WHERE "mcpServerId" = OLD."id";
  ELSE
    DELETE FROM "company_evidence" WHERE "dataRoomItemId" = OLD."id";
    DELETE FROM "company_candidates"
    WHERE "dataRoomItemId" = OLD."id";
  END IF;
  RETURN OLD;
END
$$;

CREATE TRIGGER "company_connection_disconnect"
BEFORE DELETE ON "connections"
FOR EACH ROW EXECUTE FUNCTION company_disconnect_source('connection');
CREATE TRIGGER "company_mcp_disconnect"
BEFORE DELETE ON "mcp_servers"
FOR EACH ROW EXECUTE FUNCTION company_disconnect_source('mcp');
CREATE TRIGGER "company_data_room_disconnect"
BEFORE DELETE ON "data_room_items"
FOR EACH ROW EXECUTE FUNCTION company_disconnect_source('data_room');
