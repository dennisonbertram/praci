-- One row per (meeting, agent) that was woken or handed a meeting.

-- CreateTable
CREATE TABLE "meeting_handoffs" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "runId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_handoffs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meeting_handoffs_kind_chk" CHECK ("kind" IN ('source', 'route', 'share'))
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_handoffs_meetingId_botId_key" ON "meeting_handoffs"("meetingId", "botId");
CREATE INDEX "meeting_handoffs_spaceId_userId_createdAt_idx" ON "meeting_handoffs"("spaceId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "meeting_handoffs" ADD CONSTRAINT "meeting_handoffs_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_handoffs" ADD CONSTRAINT "meeting_handoffs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_handoffs" ADD CONSTRAINT "meeting_handoffs_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_handoffs" ADD CONSTRAINT "meeting_handoffs_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for the other space tables.
ALTER TABLE "meeting_handoffs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meeting_handoffs_tenant" ON "meeting_handoffs"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "meeting_handoffs_system" ON "meeting_handoffs"
  USING (current_setting('app.rls_bypass', true) = 'on');
