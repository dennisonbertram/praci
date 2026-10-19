ALTER TABLE "connections" ADD COLUMN "agentProvisionedAt" TIMESTAMP(3),
  ADD COLUMN "agentProvisionPending" BOOLEAN NOT NULL DEFAULT false;
