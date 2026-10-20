-- CreateTable
CREATE TABLE "data_room_preferences" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoFileEmail" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_room_preferences_pkey" PRIMARY KEY ("spaceId","userId")
);

-- AddForeignKey
ALTER TABLE "data_room_preferences" ADD CONSTRAINT "data_room_preferences_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "space_members"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
