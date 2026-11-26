-- A granted agent can read the connection; it can also make changes only when this is set. Existing grants stay read-only.
ALTER TABLE "bot_connection_access" ADD COLUMN "canWrite" BOOLEAN NOT NULL DEFAULT false;
