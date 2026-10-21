-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "mcpServerId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "attendees" JSONB NOT NULL DEFAULT '[]',
    "organizerEmail" TEXT,
    "sourceUrl" TEXT,
    "folders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT NOT NULL DEFAULT '',
    "privateNotes" TEXT NOT NULL DEFAULT '',
    "transcript" TEXT,
    "transcriptIndexed" BOOLEAN NOT NULL DEFAULT false,
    "digest" JSONB,
    "digestStatus" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tsv" tsvector GENERATED ALWAYS AS (
      to_tsvector('english', "title" || ' ' || "summary" || ' ' || coalesce("transcript", ''))
    ) STORED,
    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meetings_one_source_chk" CHECK (num_nonnulls("connectionId", "mcpServerId") <= 1)
);

-- CreateTable
CREATE TABLE "meeting_sync_states" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "mcpServerId" TEXT,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "cursor" TEXT,
    "syncedThrough" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meeting_sync_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meeting_sync_states_one_source_chk" CHECK (num_nonnulls("connectionId", "mcpServerId") <= 1)
);

-- CreateTable
CREATE TABLE "meeting_tombstones" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_tombstones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meetings_spaceId_userId_provider_externalId_key" ON "meetings"("spaceId", "userId", "provider", "externalId");
CREATE INDEX "meetings_spaceId_userId_startedAt_idx" ON "meetings"("spaceId", "userId", "startedAt");
CREATE INDEX "meetings_tsv_idx" ON "meetings" USING GIN ("tsv");
CREATE UNIQUE INDEX "meeting_sync_states_connectionId_key" ON "meeting_sync_states"("connectionId");
CREATE UNIQUE INDEX "meeting_sync_states_mcpServerId_key" ON "meeting_sync_states"("mcpServerId");
CREATE UNIQUE INDEX "meeting_tombstones_spaceId_userId_provider_externalId_key" ON "meeting_tombstones"("spaceId", "userId", "provider", "externalId");

-- AlterTable
ALTER TABLE "inbox_todos" ALTER COLUMN "connectionId" DROP NOT NULL;
ALTER TABLE "inbox_todos" ADD COLUMN "meetingId" TEXT;

-- CreateIndex
CREATE INDEX "inbox_todos_meetingId_idx" ON "inbox_todos"("meetingId");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_sync_states" ADD CONSTRAINT "meeting_sync_states_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_sync_states" ADD CONSTRAINT "meeting_sync_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_sync_states" ADD CONSTRAINT "meeting_sync_states_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_sync_states" ADD CONSTRAINT "meeting_sync_states_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_tombstones" ADD CONSTRAINT "meeting_tombstones_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_tombstones" ADD CONSTRAINT "meeting_tombstones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_todos" ADD CONSTRAINT "inbox_todos_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbox_todos" DROP CONSTRAINT "inbox_todos_connectionId_fkey";
ALTER TABLE "inbox_todos" ADD CONSTRAINT "inbox_todos_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
