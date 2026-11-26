-- Sorted stretches of Omi recordings.

-- CreateTable
CREATE TABLE "omi_segments" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "audioItemId" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingId" TEXT,
    "noteItemId" TEXT,
    "sortedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "omi_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "omi_segments_audioItemId_start_key" ON "omi_segments"("audioItemId", "start");

-- CreateIndex
CREATE INDEX "omi_segments_spaceId_userId_createdAt_idx" ON "omi_segments"("spaceId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "omi_segments" ADD CONSTRAINT "omi_segments_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "omi_segments" ADD CONSTRAINT "omi_segments_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "omi_segments" ADD CONSTRAINT "omi_segments_audioItemId_fkey" FOREIGN KEY ("audioItemId") REFERENCES "data_room_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "omi_segments" ADD CONSTRAINT "omi_segments_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "omi_segments" ADD CONSTRAINT "omi_segments_noteItemId_fkey" FOREIGN KEY ("noteItemId") REFERENCES "data_room_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security, as for the other space tables.
ALTER TABLE "omi_segments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "omi_segments_tenant" ON "omi_segments"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "omi_segments_system" ON "omi_segments"
  USING (current_setting('app.rls_bypass', true) = 'on');
