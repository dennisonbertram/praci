CREATE TABLE "model_oauth_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "verifierCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "model_oauth_states_createdAt_idx" ON "model_oauth_states"("createdAt");
CREATE INDEX "model_oauth_states_userId_spaceId_provider_idx" ON "model_oauth_states"("userId", "spaceId", "provider");
