-- AlterTable
ALTER TABLE "mcp_servers" ADD COLUMN "writesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cap_table_snapshots" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cap_table_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cap_table_snapshots_spaceId_userId_key" ON "cap_table_snapshots"("spaceId", "userId");

-- AddForeignKey
ALTER TABLE "cap_table_snapshots" ADD CONSTRAINT "cap_table_snapshots_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_table_snapshots" ADD CONSTRAINT "cap_table_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
