-- Delivery requests already made, so a retried Data room delivery with the same key sends nothing.
CREATE TABLE "investor_share_requests" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "investor_share_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "investor_share_requests_spaceId_userId_requestKey_key"
ON "investor_share_requests"("spaceId", "userId", "requestKey");

ALTER TABLE "investor_share_requests" ADD CONSTRAINT "investor_share_requests_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investor_share_requests" ADD CONSTRAINT "investor_share_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, as for investor_shares.
ALTER TABLE "investor_share_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investor_share_requests_tenant" ON "investor_share_requests"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "investor_share_requests_system" ON "investor_share_requests"
  USING (current_setting('app.rls_bypass', true) = 'on');
