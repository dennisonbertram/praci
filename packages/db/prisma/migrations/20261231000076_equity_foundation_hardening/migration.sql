-- Preserve cap-table records when a parent space or user is removed.
ALTER TABLE "equity_ledgers" DROP CONSTRAINT "equity_ledgers_spaceId_fkey";
ALTER TABLE "equity_ledgers" ADD CONSTRAINT "equity_ledgers_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equity_ledgers" DROP CONSTRAINT "equity_ledgers_userId_fkey";
ALTER TABLE "equity_ledgers" ADD CONSTRAINT "equity_ledgers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "equity_vesting_templates_id_spaceId_userId_key"
  ON "equity_vesting_templates"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "equity_vesting_schedules_id_spaceId_userId_key"
  ON "equity_vesting_schedules"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "equity_convertible_blocks_id_spaceId_userId_key"
  ON "equity_convertible_blocks"("id", "spaceId", "userId");
CREATE UNIQUE INDEX "equity_funding_rounds_id_spaceId_userId_key"
  ON "equity_funding_rounds"("id", "spaceId", "userId");

ALTER TABLE "equity_stakeholders" DROP CONSTRAINT "equity_stakeholders_parentId_fkey";
ALTER TABLE "equity_stakeholders" ADD CONSTRAINT "equity_stakeholders_parentId_spaceId_userId_fkey"
  FOREIGN KEY ("parentId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_stakeholders" DROP CONSTRAINT "equity_stakeholders_contactId_fkey";
ALTER TABLE "equity_stakeholders" ADD CONSTRAINT "equity_stakeholders_contactId_spaceId_userId_fkey"
  FOREIGN KEY ("contactId", "spaceId", "userId") REFERENCES "contacts"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
DROP INDEX "equity_stakeholders_contactId_idx";
CREATE UNIQUE INDEX "equity_stakeholders_spaceId_userId_contactId_key"
  ON "equity_stakeholders"("spaceId", "userId", "contactId");

ALTER TABLE "equity_vesting_schedules" DROP CONSTRAINT "equity_vesting_schedules_templateId_fkey";
ALTER TABLE "equity_vesting_schedules" ADD CONSTRAINT "equity_vesting_schedules_templateId_spaceId_userId_fkey"
  FOREIGN KEY ("templateId", "spaceId", "userId") REFERENCES "equity_vesting_templates"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "equity_certificates" DROP CONSTRAINT "equity_certificates_planId_fkey";
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_planId_spaceId_userId_fkey"
  FOREIGN KEY ("planId", "spaceId", "userId") REFERENCES "equity_plans"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_certificates" DROP CONSTRAINT "equity_certificates_vestingScheduleId_fkey";
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_vestingScheduleId_spaceId_userId_fkey"
  FOREIGN KEY ("vestingScheduleId", "spaceId", "userId") REFERENCES "equity_vesting_schedules"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_certificates" DROP CONSTRAINT "equity_certificates_parentId_fkey";
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_parentId_spaceId_userId_fkey"
  FOREIGN KEY ("parentId", "spaceId", "userId") REFERENCES "equity_certificates"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_certificates" DROP CONSTRAINT "equity_certificates_roundId_fkey";
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_roundId_spaceId_userId_fkey"
  FOREIGN KEY ("roundId", "spaceId", "userId") REFERENCES "equity_funding_rounds"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "equity_option_grants" DROP CONSTRAINT "equity_option_grants_vestingScheduleId_fkey";
ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_vestingScheduleId_spaceId_userId_fkey"
  FOREIGN KEY ("vestingScheduleId", "spaceId", "userId") REFERENCES "equity_vesting_schedules"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "equity_convertibles" DROP CONSTRAINT "equity_convertibles_blockId_fkey";
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_blockId_spaceId_userId_fkey"
  FOREIGN KEY ("blockId", "spaceId", "userId") REFERENCES "equity_convertible_blocks"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_convertibles" DROP CONSTRAINT "equity_convertibles_convertsToShareClassId_fkey";
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_convertsToShareClassId_spaceId_userId_fkey"
  FOREIGN KEY ("convertsToShareClassId", "spaceId", "userId") REFERENCES "equity_share_classes"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_convertibles" DROP CONSTRAINT "equity_convertibles_convertedToId_fkey";
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_convertedToId_spaceId_userId_fkey"
  FOREIGN KEY ("convertedToId", "spaceId", "userId") REFERENCES "equity_certificates"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_convertibles" DROP CONSTRAINT "equity_convertibles_roundId_fkey";
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_roundId_spaceId_userId_fkey"
  FOREIGN KEY ("roundId", "spaceId", "userId") REFERENCES "equity_funding_rounds"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "equity_exercises" DROP CONSTRAINT "equity_exercises_certificateId_fkey";
ALTER TABLE "equity_exercises" ADD CONSTRAINT "equity_exercises_certificateId_spaceId_userId_fkey"
  FOREIGN KEY ("certificateId", "spaceId", "userId") REFERENCES "equity_certificates"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_transactions" DROP CONSTRAINT "equity_transactions_certificateId_fkey";
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_certificateId_spaceId_userId_fkey"
  FOREIGN KEY ("certificateId", "spaceId", "userId") REFERENCES "equity_certificates"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_transactions" DROP CONSTRAINT "equity_transactions_convertibleId_fkey";
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_convertibleId_spaceId_userId_fkey"
  FOREIGN KEY ("convertibleId", "spaceId", "userId") REFERENCES "equity_convertibles"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_transactions" DROP CONSTRAINT "equity_transactions_optionGrantId_fkey";
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_optionGrantId_spaceId_userId_fkey"
  FOREIGN KEY ("optionGrantId", "spaceId", "userId") REFERENCES "equity_option_grants"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_transactions" DROP CONSTRAINT "equity_transactions_planId_fkey";
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_planId_spaceId_userId_fkey"
  FOREIGN KEY ("planId", "spaceId", "userId") REFERENCES "equity_plans"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "equity_exercises_spaceId_userId_exerciseDate_id_idx"
  ON "equity_exercises"("spaceId", "userId", "exerciseDate", "id");
CREATE INDEX "equity_access_grants_spaceId_userId_idx"
  ON "equity_access_grants"("spaceId", "userId");
CREATE UNIQUE INDEX "equity_certificates_vestingScheduleId_spaceId_userId_key"
  ON "equity_certificates"("vestingScheduleId", "spaceId", "userId");
CREATE UNIQUE INDEX "equity_option_grants_vestingScheduleId_spaceId_userId_key"
  ON "equity_option_grants"("vestingScheduleId", "spaceId", "userId");

ALTER TABLE "equity_share_class_versions" ADD CONSTRAINT "equity_share_class_versions_nonnegative_check"
  CHECK ("authorizedShares" >= 0 AND "votesPerShare" >= 0 AND ("parValue" IS NULL OR "parValue" >= 0) AND ("originalIssuePrice" IS NULL OR "originalIssuePrice" >= 0) AND ("conversionPrice" IS NULL OR "conversionPrice" >= 0) AND "conversionRatio" >= 0 AND "multiplier" >= 0 AND ("participationCap" IS NULL OR "participationCap" >= 0) AND ("dividendYield" IS NULL OR "dividendYield" >= 0));
ALTER TABLE "equity_plans" ADD CONSTRAINT "equity_plans_reservedShares_nonnegative_check"
  CHECK ("reservedShares" >= 0);
ALTER TABLE "equity_vesting_templates" ADD CONSTRAINT "equity_vesting_templates_months_check"
  CHECK ("totalMonths" >= 0 AND "cliffMonths" >= 0 AND "frequencyMonths" > 0);
ALTER TABLE "equity_vesting_schedules" ADD CONSTRAINT "equity_vesting_schedules_months_check"
  CHECK ("totalMonths" >= 0 AND "cliffMonths" >= 0 AND "frequencyMonths" > 0 AND ("acceleratedShares" IS NULL OR "acceleratedShares" >= 0));
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_nonnegative_check"
  CHECK ("quantity" >= 0 AND ("pricePerShare" IS NULL OR "pricePerShare" >= 0) AND ("pricePaidPerShare" IS NULL OR "pricePaidPerShare" >= 0) AND "cashPaidCents" >= 0 AND "debtCanceledCents" >= 0 AND "ipTransferredCents" >= 0 AND "otherConsiderationCents" >= 0 AND ("costBasisCents" IS NULL OR "costBasisCents" >= 0));
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_nonnegative_check"
  CHECK ("principalCents" >= 0 AND ("interestRate" IS NULL OR "interestRate" >= 0) AND ("valuationCapCents" IS NULL OR "valuationCapCents" >= 0) AND ("discountPercent" IS NULL OR ("discountPercent" >= 0 AND "discountPercent" <= 100)) AND ("cashoutMultiplier" IS NULL OR "cashoutMultiplier" >= 0));
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_nonnegative_check"
  CHECK (("quantity" IS NULL OR "quantity" >= 0) AND ("valueCents" IS NULL OR "valueCents" >= 0));
ALTER TABLE "equity_funding_rounds" ADD CONSTRAINT "equity_funding_rounds_nonnegative_check"
  CHECK (("originalIssuePrice" IS NULL OR "originalIssuePrice" >= 0) AND ("preMoneyValuationCents" IS NULL OR "preMoneyValuationCents" >= 0));
