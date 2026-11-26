ALTER TABLE "equity_vesting_templates"
  DROP CONSTRAINT "equity_vesting_templates_months_check";
ALTER TABLE "equity_vesting_templates"
  ADD CONSTRAINT "equity_vesting_templates_months_check"
  CHECK ("totalMonths" >= 0 AND "cliffMonths" >= 0 AND "cliffMonths" <= "totalMonths" AND "frequencyMonths" > 0);

ALTER TABLE "equity_vesting_schedules"
  DROP CONSTRAINT "equity_vesting_schedules_months_check";
ALTER TABLE "equity_vesting_schedules"
  ADD CONSTRAINT "equity_vesting_schedules_months_check"
  CHECK ("totalMonths" >= 0 AND "cliffMonths" >= 0 AND "cliffMonths" <= "totalMonths" AND "frequencyMonths" > 0 AND ("acceleratedShares" IS NULL OR "acceleratedShares" >= 0));

ALTER TABLE "equity_convertibles"
  DROP CONSTRAINT "equity_convertibles_nonnegative_check";
ALTER TABLE "equity_convertibles"
  ADD CONSTRAINT "equity_convertibles_nonnegative_check"
  CHECK ("principalCents" >= 0 AND ("interestRate" IS NULL OR "interestRate" >= 0) AND ("valuationCapCents" IS NULL OR "valuationCapCents" >= 0) AND ("discountPercent" IS NULL OR ("discountPercent" >= 0 AND "discountPercent" < 100)) AND ("cashoutMultiplier" IS NULL OR "cashoutMultiplier" >= 0));
