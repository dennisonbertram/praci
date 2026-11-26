-- An agent's archive names the effect it came from, so an Undo in the inbox reaches the
-- approval decision log.
ALTER TABLE "mail_action_logs" ADD COLUMN "effectId" TEXT;
