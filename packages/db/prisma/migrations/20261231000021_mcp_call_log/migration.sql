-- Rate-limit counter on the connection, and a call log without arguments or results.

-- AlterTable
ALTER TABLE "mcp_connections" ADD COLUMN "rateWindowStart" TIMESTAMP(3),
ADD COLUMN "rateCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "mcp_call_log" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_call_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_call_log_connectionId_createdAt_idx" ON "mcp_call_log"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "mcp_call_log" ADD CONSTRAINT "mcp_call_log_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mcp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_call_log" ADD CONSTRAINT "mcp_call_log_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for mcp_connections.
ALTER TABLE "mcp_call_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mcp_call_log_tenant" ON "mcp_call_log"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "mcp_call_log_system" ON "mcp_call_log"
  USING (current_setting('app.rls_bypass', true) = 'on');
