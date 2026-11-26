-- Local desktop control: per-bot settings and the run-scoped ref ownership table.
ALTER TABLE "bots" ADD COLUMN "appControlEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bots" ADD COLUMN "appControlApps" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "bots" ADD COLUMN "appControlHeaded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
-- runId has no foreign key: rows are deleted when the run ends and by age.
CREATE TABLE "app_control_snapshots" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "windowId" TEXT,
    "surface" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL,
    "spent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_control_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_control_snapshots_spaceId_userId_botId_runId_snapshotId_key" ON "app_control_snapshots"("spaceId", "userId", "botId", "runId", "snapshotId");

-- CreateIndex
CREATE INDEX "app_control_snapshots_runId_idx" ON "app_control_snapshots"("runId");

-- CreateIndex
CREATE INDEX "app_control_snapshots_createdAt_idx" ON "app_control_snapshots"("createdAt");

-- AddForeignKey
ALTER TABLE "app_control_snapshots" ADD CONSTRAINT "app_control_snapshots_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_control_snapshots" ADD CONSTRAINT "app_control_snapshots_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for the other space tables.
ALTER TABLE "app_control_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_control_snapshots_tenant" ON "app_control_snapshots"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "app_control_snapshots_system" ON "app_control_snapshots"
  USING (current_setting('app.rls_bypass', true) = 'on');
