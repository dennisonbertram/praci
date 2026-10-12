-- CreateTable
CREATE TABLE "compose_sends" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "draftId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "providerMessageId" TEXT,
    "threadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compose_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compose_sends_connectionId_idx" ON "compose_sends"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "compose_sends_spaceId_userId_clientId_key" ON "compose_sends"("spaceId", "userId", "clientId");

-- AddForeignKey
ALTER TABLE "compose_sends" ADD CONSTRAINT "compose_sends_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compose_sends" ADD CONSTRAINT "compose_sends_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compose_sends" ADD CONSTRAINT "compose_sends_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
