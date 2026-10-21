ALTER TABLE "company_rejections"
  ADD COLUMN "excludedPerson" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "company_source_blocks" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "connectionId" TEXT,
  "mcpServerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_source_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_source_blocks_source_kind_check"
    CHECK ("sourceKind" IN ('gmail', 'data_room', 'slack', 'github', 'linear', 'notion', 'mcp', 'composio')),
  CONSTRAINT "company_source_blocks_locator_check"
    CHECK (NOT ("connectionId" IS NOT NULL AND "mcpServerId" IS NOT NULL))
);

CREATE UNIQUE INDEX "company_source_blocks_spaceId_ownerUserId_sourceKey_key"
  ON "company_source_blocks"("spaceId", "ownerUserId", "sourceKey");
CREATE INDEX "company_source_blocks_spaceId_ownerUserId_sourceKind_idx"
  ON "company_source_blocks"("spaceId", "ownerUserId", "sourceKind");

ALTER TABLE "company_source_blocks"
  ADD CONSTRAINT "company_source_blocks_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "company_source_blocks_owner_fkey"
    FOREIGN KEY ("spaceId", "ownerUserId") REFERENCES "space_members"("spaceId", "userId")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "company_unshare_entity_on_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."visibility" = 'team' AND NEW."visibility" = 'team'
    AND ROW(OLD."kind", OLD."displayName", OLD."attrs")
        IS DISTINCT FROM ROW(NEW."kind", NEW."displayName", NEW."attrs") THEN
    NEW."visibility" := 'private';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION "company_unshare_edge_on_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."visibility" = 'team' AND NEW."visibility" = 'team'
    AND ROW(OLD."fromId", OLD."toId", OLD."relation", OLD."role", OLD."startsOn",
            OLD."startsPrecision", OLD."endsOn", OLD."endsPrecision")
        IS DISTINCT FROM ROW(NEW."fromId", NEW."toId", NEW."relation", NEW."role", NEW."startsOn",
            NEW."startsPrecision", NEW."endsOn", NEW."endsPrecision") THEN
    NEW."visibility" := 'private';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION "company_unshare_event_on_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."visibility" = 'team' AND NEW."visibility" = 'team'
    AND ROW(OLD."stream", OLD."kind", OLD."title", OLD."occursOn", OLD."occursPrecision",
            OLD."endsOn", OLD."endsPrecision", OLD."amountCents", OLD."currency")
        IS DISTINCT FROM ROW(NEW."stream", NEW."kind", NEW."title", NEW."occursOn",
            NEW."occursPrecision", NEW."endsOn", NEW."endsPrecision", NEW."amountCents",
            NEW."currency") THEN
    NEW."visibility" := 'private';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "company_entities_unshare_semantic_change"
BEFORE UPDATE ON "company_entities"
FOR EACH ROW EXECUTE FUNCTION "company_unshare_entity_on_change"();

CREATE FUNCTION "company_unshare_entity_relations"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."visibility" = 'team' AND NEW."visibility" = 'private' THEN
    UPDATE "company_edges"
    SET "visibility" = 'private'
    WHERE "spaceId" = NEW."spaceId" AND "ownerUserId" = NEW."ownerUserId"
      AND "visibility" = 'team' AND (("fromId" = NEW."id") OR ("toId" = NEW."id"));
    UPDATE "company_events" event
    SET "visibility" = 'private'
    WHERE event."spaceId" = NEW."spaceId" AND event."ownerUserId" = NEW."ownerUserId"
      AND event."visibility" = 'team'
      AND EXISTS (
        SELECT 1 FROM "company_event_entities" link
        WHERE link."spaceId" = NEW."spaceId" AND link."ownerUserId" = NEW."ownerUserId"
          AND link."eventId" = event."id" AND link."entityId" = NEW."id"
      );
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER "company_entities_unshare_relations"
AFTER UPDATE ON "company_entities"
FOR EACH ROW EXECUTE FUNCTION "company_unshare_entity_relations"();
CREATE TRIGGER "company_edges_unshare_semantic_change"
BEFORE UPDATE ON "company_edges"
FOR EACH ROW EXECUTE FUNCTION "company_unshare_edge_on_change"();
CREATE TRIGGER "company_events_unshare_semantic_change"
BEFORE UPDATE ON "company_events"
FOR EACH ROW EXECUTE FUNCTION "company_unshare_event_on_change"();

CREATE FUNCTION "company_unshare_event_subject_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "company_events"
    SET "visibility" = 'private'
    WHERE "id" = OLD."eventId" AND "spaceId" = OLD."spaceId"
      AND "ownerUserId" = OLD."ownerUserId" AND "visibility" = 'team';
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE "company_events"
    SET "visibility" = 'private'
    WHERE "id" IN (OLD."eventId", NEW."eventId") AND "spaceId" = NEW."spaceId"
      AND "ownerUserId" = NEW."ownerUserId" AND "visibility" = 'team';
  ELSE
    UPDATE "company_events"
    SET "visibility" = 'private'
    WHERE "id" = NEW."eventId" AND "spaceId" = NEW."spaceId"
      AND "ownerUserId" = NEW."ownerUserId" AND "visibility" = 'team';
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER "company_event_entities_unshare_parent"
AFTER INSERT OR UPDATE OR DELETE ON "company_event_entities"
FOR EACH ROW EXECUTE FUNCTION "company_unshare_event_subject_change"();
