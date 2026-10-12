-- AlterTable
ALTER TABLE "mail_messages" ADD COLUMN     "alreadyHandled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "dueOn" DATE,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "todoText" TEXT,
ADD COLUMN     "triageVersion" INTEGER,
ADD COLUMN     "triagedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "inbox_todos" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "messageId" TEXT,
    "text" TEXT NOT NULL,
    "detail" TEXT,
    "dueOn" DATE,
    "doneAt" TIMESTAMP(3),
    "touchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbox_todos_spaceId_userId_doneAt_idx" ON "inbox_todos"("spaceId", "userId", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_todos_userId_messageId_key" ON "inbox_todos"("userId", "messageId");

-- AddForeignKey
ALTER TABLE "inbox_todos" ADD CONSTRAINT "inbox_todos_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_todos" ADD CONSTRAINT "inbox_todos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_todos" ADD CONSTRAINT "inbox_todos_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_todos" ADD CONSTRAINT "inbox_todos_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "mail_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
