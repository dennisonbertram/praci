-- Notes pinned to a day on the Finance Burn chart.
CREATE TABLE "finance_chart_notes" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_chart_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_chart_notes_spaceId_day_idx" ON "finance_chart_notes"("spaceId", "day");

-- Row-level security, as for the other Space-owned finance tables.
ALTER TABLE "finance_chart_notes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_chart_notes_tenant" ON "finance_chart_notes"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "finance_chart_notes_system" ON "finance_chart_notes"
  USING (current_setting('app.rls_bypass', true) = 'on');
