-- A NULL sourceConnectionId (chat, finance) must still dedupe on externalId, and one member's
-- external ids must not collide with another member's. NULLS NOT DISTINCT needs Postgres 15+.
DROP INDEX "data_room_items_external_key";
CREATE UNIQUE INDEX "data_room_items_external_key"
  ON "data_room_items"("spaceId", "userId", "sourceConnectionId", "externalId") NULLS NOT DISTINCT
  WHERE "externalId" IS NOT NULL;
