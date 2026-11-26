-- View-only public links to one artifact version. Only the sha256 of the token is stored.
CREATE TABLE "artifact_shares" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),

    CONSTRAINT "artifact_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "artifact_shares_tokenHash_key" ON "artifact_shares"("tokenHash");
CREATE INDEX "artifact_shares_spaceId_artifactId_idx" ON "artifact_shares"("spaceId", "artifactId");

ALTER TABLE "artifact_shares" ADD CONSTRAINT "artifact_shares_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifact_shares" ADD CONSTRAINT "artifact_shares_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
