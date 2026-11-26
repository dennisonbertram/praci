-- CreateTable
CREATE TABLE "equity_stakeholder_changes" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "stakeholderId" TEXT,
    "employeeId" TEXT,
    "externalName" TEXT,
    "externalEmail" TEXT,
    "proposed" JSONB NOT NULL DEFAULT '{}',
    "terminationDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acceptedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_stakeholder_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_hris_preferences" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoUpdates" BOOLEAN NOT NULL DEFAULT false,
    "autoFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoCreate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_hris_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equity_stakeholder_changes_spaceId_userId_status_kind_idx" ON "equity_stakeholder_changes"("spaceId", "userId", "status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "equity_hris_preferences_spaceId_userId_key" ON "equity_hris_preferences"("spaceId", "userId");

-- AddForeignKey
ALTER TABLE "equity_stakeholder_changes" ADD CONSTRAINT "equity_stakeholder_changes_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_hris_preferences" ADD CONSTRAINT "equity_hris_preferences_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for the foundation equity tables.
DO $$
DECLARE
  protected text;
BEGIN
  FOREACH protected IN ARRAY ARRAY[
    'equity_stakeholder_changes',
    'equity_hris_preferences'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("spaceId" = NULLIF(current_setting(''app.space_id'', true), '''') AND "userId" = NULLIF(current_setting(''app.user_id'', true), ''''))',
      protected || '_tenant', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.rls_bypass'', true) = ''on'')',
      protected || '_system', protected);
  END LOOP;
END $$;
