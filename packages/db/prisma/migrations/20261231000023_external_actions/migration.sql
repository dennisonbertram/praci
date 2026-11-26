-- Writes from outside MCP clients that wait for a person's approval.

-- CreateTable
CREATE TABLE "external_actions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "external_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_actions_spaceId_userId_status_idx" ON "external_actions"("spaceId", "userId", "status");

-- CreateIndex
CREATE INDEX "external_actions_connectionId_createdAt_idx" ON "external_actions"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "external_actions_status_createdAt_idx" ON "external_actions"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "external_actions" ADD CONSTRAINT "external_actions_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_actions" ADD CONSTRAINT "external_actions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "mcp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for mcp_call_log.
ALTER TABLE "external_actions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external_actions_tenant" ON "external_actions"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "external_actions_system" ON "external_actions"
  USING (current_setting('app.rls_bypass', true) = 'on');
