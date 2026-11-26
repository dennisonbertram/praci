ALTER TABLE "equity_exercises" ADD COLUMN "requestKey" UUID;

CREATE UNIQUE INDEX "equity_exercises_spaceId_userId_requestKey_key"
ON "equity_exercises"("spaceId", "userId", "requestKey");
