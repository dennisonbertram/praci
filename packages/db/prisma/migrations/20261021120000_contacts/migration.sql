-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "organization" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'investor',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_spaceId_userId_idx" ON "contacts"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_spaceId_userId_email_key" ON "contacts"("spaceId", "userId", "email");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
