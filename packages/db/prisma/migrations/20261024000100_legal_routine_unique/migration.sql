-- One daily scan routine per Legal agent, even when two requests create the agent at once.
-- Partial index, so it is raw SQL like finance_accounts_statement_key and not in schema.prisma.
CREATE UNIQUE INDEX "routines_legal_scan_key" ON "routines"("botId") WHERE "name" = 'Daily legal scan';
