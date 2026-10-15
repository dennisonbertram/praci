-- Why the last sync failed (MailProviderError.kind), so the Inbox can tell a rate limit from an outage.
ALTER TABLE "mail_sync_states" ADD COLUMN "lastErrorKind" TEXT;
