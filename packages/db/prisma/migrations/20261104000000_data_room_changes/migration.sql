-- CreateTable
CREATE TABLE "data_room_changes" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "data_room_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_room_changes_spaceId_userId_batchId_seq_idx" ON "data_room_changes"("spaceId", "userId", "batchId", "seq");

-- AddForeignKey
ALTER TABLE "data_room_changes" ADD CONSTRAINT "data_room_changes_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
