-- An address belongs to one endpoint. Keep the most recently updated row for each duplicate.
DELETE FROM "notification_endpoints" a
USING "notification_endpoints" b
WHERE a."channel" = b."channel"
  AND a."address" = b."address"
  AND (a."updatedAt", a."id") < (b."updatedAt", b."id");

DROP INDEX "notification_endpoints_channel_address_idx";

CREATE UNIQUE INDEX "notification_endpoints_channel_address_key" ON "notification_endpoints"("channel", "address");
