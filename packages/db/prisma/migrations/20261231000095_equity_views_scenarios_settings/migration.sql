-- Views area: saved round modeling scenarios and the estimated value settings.
CREATE TABLE "equity_round_scenarios" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preMoneyValuationCents" BIGINT NOT NULL,
    "targetPoolPercent" DECIMAL(24,10),
    "investments" JSONB NOT NULL DEFAULT '[]',
    "convertibleIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_round_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equity_round_scenarios_spaceId_userId_name_key" ON "equity_round_scenarios"("spaceId", "userId", "name");

ALTER TABLE "equity_round_scenarios" ADD CONSTRAINT "equity_round_scenarios_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "equity_views_settings" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estimatedValueVisibility" TEXT NOT NULL DEFAULT 'hidden',
    "pricePerShare" DECIMAL(24,10),
    "effectiveDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_views_settings_pkey" PRIMARY KEY ("spaceId", "userId")
);

ALTER TABLE "equity_views_settings" ADD CONSTRAINT "equity_views_settings_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE
  protected text;
BEGIN
  FOREACH protected IN ARRAY ARRAY['equity_round_scenarios', 'equity_views_settings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("spaceId" = NULLIF(current_setting(''app.space_id'', true), '''') AND "userId" = NULLIF(current_setting(''app.user_id'', true), ''''))',
      protected || '_tenant', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.rls_bypass'', true) = ''on'')',
      protected || '_system', protected);
  END LOOP;
END $$;
