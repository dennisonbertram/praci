CREATE UNIQUE INDEX "equity_plans_id_shareClassId_spaceId_userId_key"
  ON "equity_plans"("id", "shareClassId", "spaceId", "userId");

ALTER TABLE "equity_option_grants" DROP CONSTRAINT "equity_option_grants_planId_spaceId_userId_fkey";
ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_planId_shareClassId_spaceId_userId_fkey"
  FOREIGN KEY ("planId", "shareClassId", "spaceId", "userId")
  REFERENCES "equity_plans"("id", "shareClassId", "spaceId", "userId")
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_nonnegative_check"
  CHECK (
    "quantity" >= 0 AND "exercisedQuantity" >= 0 AND "canceledQuantity" >= 0
    AND "canceledQuantity" <= "quantity"
    AND "exercisedQuantity" <= "quantity" - "canceledQuantity"
    AND "exercisePrice" >= 0
    AND ("postTerminationExerciseMonths" IS NULL OR "postTerminationExerciseMonths" >= 0)
  );
ALTER TABLE "equity_exercises" ADD CONSTRAINT "equity_exercises_nonnegative_check"
  CHECK ("quantity" >= 0 AND "paymentCents" >= 0);
ALTER TABLE "equity_warrants" ADD CONSTRAINT "equity_warrants_nonnegative_check"
  CHECK ("quantity" >= 0 AND "exercisePrice" >= 0);
