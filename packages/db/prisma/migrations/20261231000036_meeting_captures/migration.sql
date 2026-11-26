-- Meeting recordings made on a device, and their chunks of audio or text.

-- CreateTable
CREATE TABLE "meeting_captures" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT,
    "engine" TEXT NOT NULL,
    "tracks" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'recording',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastChunkAt" TIMESTAMP(3),
    "consentConfirmedAt" TIMESTAMP(3),
    "meetingId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_captures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meeting_captures_engine_chk" CHECK ("engine" IN ('device', 'server')),
    CONSTRAINT "meeting_captures_status_chk" CHECK ("status" IN ('recording', 'finishing', 'done', 'failed', 'discarded'))
);

-- CreateTable
CREATE TABLE "meeting_capture_chunks" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "blobKey" TEXT,
    "text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_capture_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meeting_capture_chunks_track_chk" CHECK ("track" IN ('microphone', 'system')),
    CONSTRAINT "meeting_capture_chunks_status_chk" CHECK ("status" IN ('pending', 'done', 'failed'))
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_captures_userId_clientId_key" ON "meeting_captures"("userId", "clientId");
CREATE INDEX "meeting_captures_spaceId_userId_status_idx" ON "meeting_captures"("spaceId", "userId", "status");
CREATE UNIQUE INDEX "meeting_capture_chunks_captureId_track_seq_key" ON "meeting_capture_chunks"("captureId", "track", "seq");

-- AddForeignKey
ALTER TABLE "meeting_captures" ADD CONSTRAINT "meeting_captures_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_captures" ADD CONSTRAINT "meeting_captures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_captures" ADD CONSTRAINT "meeting_captures_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_capture_chunks" ADD CONSTRAINT "meeting_capture_chunks_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_capture_chunks" ADD CONSTRAINT "meeting_capture_chunks_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "meeting_captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for the other space tables.
ALTER TABLE "meeting_captures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meeting_captures_tenant" ON "meeting_captures"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "meeting_captures_system" ON "meeting_captures"
  USING (current_setting('app.rls_bypass', true) = 'on');
ALTER TABLE "meeting_capture_chunks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meeting_capture_chunks_tenant" ON "meeting_capture_chunks"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "meeting_capture_chunks_system" ON "meeting_capture_chunks"
  USING (current_setting('app.rls_bypass', true) = 'on');
