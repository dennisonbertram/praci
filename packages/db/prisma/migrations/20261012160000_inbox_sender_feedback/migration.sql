-- CreateTable
CREATE TABLE "inbox_sender_feedback" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "mark" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_sender_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_sender_feedback_spaceId_userId_senderAddress_key" ON "inbox_sender_feedback"("spaceId", "userId", "senderAddress");

-- AddForeignKey
ALTER TABLE "inbox_sender_feedback" ADD CONSTRAINT "inbox_sender_feedback_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_sender_feedback" ADD CONSTRAINT "inbox_sender_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
