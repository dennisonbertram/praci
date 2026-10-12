-- CreateTable
CREATE TABLE "mail_messages" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromName" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "unread" BOOLEAN NOT NULL,
    "inInbox" BOOLEAN NOT NULL DEFAULT false,
    "fromSelf" BOOLEAN NOT NULL DEFAULT false,
    "needsReply" BOOLEAN,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_sync_states" (
    "connectionId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "claimToken" TEXT,

    CONSTRAINT "mail_sync_states_pkey" PRIMARY KEY ("connectionId")
);

-- CreateIndex
CREATE INDEX "mail_messages_spaceId_userId_inInbox_receivedAt_idx" ON "mail_messages"("spaceId", "userId", "inInbox", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "mail_messages_connectionId_providerMessageId_key" ON "mail_messages"("connectionId", "providerMessageId");

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sync_states" ADD CONSTRAINT "mail_sync_states_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
