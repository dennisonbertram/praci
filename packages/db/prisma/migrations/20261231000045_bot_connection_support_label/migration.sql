-- Support scope for a firewalled agent: the Gmail label it may read on this connection.
ALTER TABLE "bot_connection_access" ADD COLUMN "supportLabel" TEXT;
