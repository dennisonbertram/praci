-- A bot, routine or routine run can run on one specific model connection instead of the space
-- default. Plain columns, not foreign keys: an automatic sign-out deletes the credential, and the
-- pin has to survive that so the run fails by name instead of using another connection.
ALTER TABLE "bots" ADD COLUMN "modelCredentialId" TEXT;
ALTER TABLE "routines" ADD COLUMN "modelCredentialId" TEXT;
ALTER TABLE "runs" ADD COLUMN "modelCredentialId" TEXT;

CREATE INDEX "bots_modelCredentialId_idx" ON "bots"("modelCredentialId");
CREATE INDEX "routines_modelCredentialId_idx" ON "routines"("modelCredentialId");
ALTER TABLE "steering_messages" ADD COLUMN "modelCredentialId" TEXT;
