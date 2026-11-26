-- A company context section is a memory document of scope 'company' with no bot. NULL bot ids do not
-- collide in the table's own unique index, so this partial index makes a name unique per user and space.
CREATE UNIQUE INDEX "memory_documents_company_section_key"
  ON "memory_documents" ("spaceId", "userId", "path")
  WHERE "scope" = 'company';
