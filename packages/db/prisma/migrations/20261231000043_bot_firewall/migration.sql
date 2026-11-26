-- Agent firewall flag. Off for every existing agent.
ALTER TABLE "bots" ADD COLUMN "firewall" BOOLEAN NOT NULL DEFAULT false;
