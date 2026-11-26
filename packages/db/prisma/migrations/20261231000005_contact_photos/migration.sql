-- CreateTable
CREATE TABLE "contact_photos" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_photos_pkey" PRIMARY KEY ("spaceId","userId","email")
);

-- CreateTable
CREATE TABLE "contact_photo_syncs" (
    "connectionId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_photo_syncs_pkey" PRIMARY KEY ("connectionId")
);

-- AddForeignKey
ALTER TABLE "contact_photos" ADD CONSTRAINT "contact_photos_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_photos" ADD CONSTRAINT "contact_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_photo_syncs" ADD CONSTRAINT "contact_photo_syncs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
