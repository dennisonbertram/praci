-- CreateTable
CREATE TABLE "devin_connection_states" (
    "serverId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "backoffUntil" TIMESTAMP(3),
    "backoffStep" INTEGER NOT NULL DEFAULT 0,
    "rejectedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "devin_connection_states_pkey" PRIMARY KEY ("serverId")
);

-- CreateTable
CREATE TABLE "devin_sessions" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "kind" TEXT NOT NULL,
    "question" TEXT,
    "prs" JSONB NOT NULL DEFAULT '[]',
    "origin" TEXT NOT NULL,
    "devinUpdatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageId" TEXT,
    "notifiedMessageId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devin_connection_states_spaceId_key" ON "devin_connection_states"("spaceId");

-- CreateIndex
CREATE INDEX "devin_sessions_spaceId_kind_idx" ON "devin_sessions"("spaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "devin_sessions_serverId_sessionId_key" ON "devin_sessions"("serverId", "sessionId");

-- AddForeignKey
ALTER TABLE "devin_connection_states" ADD CONSTRAINT "devin_connection_states_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devin_sessions" ADD CONSTRAINT "devin_sessions_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
