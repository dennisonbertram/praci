ALTER TABLE "company_import_sources"
ADD COLUMN "mcpServerId" TEXT;

CREATE INDEX "company_import_sources_mcpServerId_idx"
ON "company_import_sources" ("mcpServerId");
