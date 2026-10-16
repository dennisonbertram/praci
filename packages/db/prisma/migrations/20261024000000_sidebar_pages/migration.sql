-- CreateTable
CREATE TABLE "sidebar_pages" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sidebar_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sidebar_pages_spaceId_userId_idx" ON "sidebar_pages"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "sidebar_pages_spaceId_userId_templateKey_key" ON "sidebar_pages"("spaceId", "userId", "templateKey");

-- AddForeignKey
ALTER TABLE "sidebar_pages" ADD CONSTRAINT "sidebar_pages_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sidebar_pages" ADD CONSTRAINT "sidebar_pages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
