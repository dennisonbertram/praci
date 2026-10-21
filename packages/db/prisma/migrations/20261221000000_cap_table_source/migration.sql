-- Cap table source: one writer per table, enforced by a conditional update; one version back for Undo.
ALTER TABLE "cap_table_snapshots" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'carta';
ALTER TABLE "cap_table_snapshots" ADD COLUMN "previous" JSONB;
