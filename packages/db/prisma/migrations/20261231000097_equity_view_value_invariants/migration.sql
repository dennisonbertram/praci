ALTER TABLE "equity_round_scenarios" ADD CONSTRAINT "equity_round_scenarios_nonnegative_check"
  CHECK (
    "preMoneyValuationCents" >= 0
    AND ("targetPoolPercent" IS NULL OR ("targetPoolPercent" >= 0 AND "targetPoolPercent" <= 100))
  );
ALTER TABLE "equity_views_settings" ADD CONSTRAINT "equity_views_settings_pricePerShare_nonnegative_check"
  CHECK ("pricePerShare" IS NULL OR "pricePerShare" >= 0);
