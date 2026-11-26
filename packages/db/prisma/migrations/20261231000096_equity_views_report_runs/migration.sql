-- Views area: the history of generated reports (kind, options, as-of date, when).
CREATE TABLE "equity_report_runs" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equity_report_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "equity_report_runs_spaceId_userId_createdAt_idx" ON "equity_report_runs"("spaceId", "userId", "createdAt");

ALTER TABLE "equity_report_runs" ADD CONSTRAINT "equity_report_runs_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equity_report_runs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equity_report_runs_tenant" ON "equity_report_runs" USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '') AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "equity_report_runs_system" ON "equity_report_runs" USING (current_setting('app.rls_bypass', true) = 'on');
