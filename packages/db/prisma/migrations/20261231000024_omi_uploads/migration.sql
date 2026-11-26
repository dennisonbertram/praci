-- Raw pendant records waiting to be assembled into recordings.

-- CreateTable
CREATE TABLE "omi_uploads" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "firstSeq" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "codec" INTEGER NOT NULL,
    "rtcValid" BOOLEAN NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT NOT NULL,
    "assembledAt" TIMESTAMP(3),

    CONSTRAINT "omi_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "omi_uploads_connectionId_firstSeq_sha256_key" ON "omi_uploads"("connectionId", "firstSeq", "sha256");

-- CreateIndex
CREATE INDEX "omi_uploads_connectionId_assembledAt_idx" ON "omi_uploads"("connectionId", "assembledAt");

-- AddForeignKey
ALTER TABLE "omi_uploads" ADD CONSTRAINT "omi_uploads_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "omi_uploads" ADD CONSTRAINT "omi_uploads_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for the other space tables.
ALTER TABLE "omi_uploads" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "omi_uploads_tenant" ON "omi_uploads"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "omi_uploads_system" ON "omi_uploads"
  USING (current_setting('app.rls_bypass', true) = 'on');
