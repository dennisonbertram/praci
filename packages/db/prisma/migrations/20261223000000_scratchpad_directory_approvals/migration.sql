CREATE TABLE "scratchpad_approvals" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scratchpad_approvals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "scratchpad_approvals_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "scratchpad_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "scratchpad_approvals_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "scratchpad_approvals_scope_window_idx" ON "scratchpad_approvals"("spaceId", "userId", "botId", "category", "channel", "approvedBy", "approvedAt");

-- Item identity is a value, not a cascading FK. Only still-present approvals can be recovered.
INSERT INTO "scratchpad_approvals" ("id", "spaceId", "userId", "botId", "itemId", "category", "channel", "approvedBy", "approvedAt")
SELECT 'backfill:' || s."id", s."spaceId", s."userId", s."botId", s."id", s."category", s."channel", s."approvedBy", s."approvedAt"
FROM "scratchpad_items" s
WHERE s."category" = 'create_account' AND s."channel" = 'directory'
  AND s."approvedBy" IN ('user', 'policy') AND s."approvedAt" IS NOT NULL
  AND s."status" IN ('open', 'done')
  AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = s."userId");
