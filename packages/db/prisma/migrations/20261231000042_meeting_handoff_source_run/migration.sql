-- A run hands a meeting to at most one agent: the unique key is taken in the handoff's transaction.
ALTER TABLE "meeting_handoffs" ADD COLUMN "sourceRunId" TEXT;
CREATE UNIQUE INDEX "meeting_handoffs_sourceRunId_key" ON "meeting_handoffs"("sourceRunId");
