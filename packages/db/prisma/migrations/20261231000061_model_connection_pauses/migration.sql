-- A model connection whose account ran out of credit holds the routines on it, per space and owner.
CREATE TABLE "model_connection_pauses" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "pausedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_connection_pauses_pkey" PRIMARY KEY ("spaceId", "userId", "credentialId")
);

CREATE INDEX "model_connection_pauses_credentialId_idx" ON "model_connection_pauses"("credentialId");

ALTER TABLE "model_connection_pauses" ADD CONSTRAINT "model_connection_pauses_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_connection_pauses" ADD CONSTRAINT "model_connection_pauses_credentialId_userId_fkey"
  FOREIGN KEY ("credentialId", "userId") REFERENCES "user_model_credentials"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "routines" ADD COLUMN "pausedConnectionId" TEXT;
-- Clearing the pause clears only the routine's pointer, never its space or owner.
ALTER TABLE "routines" ADD CONSTRAINT "routines_spaceId_userId_pausedConnectionId_fkey"
  FOREIGN KEY ("spaceId", "userId", "pausedConnectionId") REFERENCES "model_connection_pauses"("spaceId", "userId", "credentialId") ON DELETE SET NULL ("pausedConnectionId") ON UPDATE CASCADE;

ALTER TABLE "model_connection_pauses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "model_connection_pauses_tenant" ON "model_connection_pauses"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "model_connection_pauses_system" ON "model_connection_pauses"
  USING (current_setting('app.rls_bypass', true) = 'on');
