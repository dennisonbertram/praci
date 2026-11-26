ALTER TABLE "bots" ADD COLUMN "firewallAskCapabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Provenance of a contact edit, so a Firewall agent's change taints later reads.
ALTER TABLE "contacts" ADD COLUMN "lastEditedByBotId" TEXT;
