-- AlterTable
ALTER TABLE "threads" ADD COLUMN "meetingTaintedAt" TIMESTAMP(3);

-- Backfill: mark the threads that already hold Granola meeting text. First the threads of the
-- agent bots of Granola MCP servers, then (repeating, so forwards of forwards are caught) every
-- thread with a received bot message whose sender is such an agent or has a marked thread.
-- Plain SQL; running it again changes nothing.
DO $$
DECLARE
  changed integer;
  rounds integer := 0;
BEGIN
  UPDATE "threads" SET "meetingTaintedAt" = now()
  WHERE "meetingTaintedAt" IS NULL
    AND "botId" IN (
      SELECT "agentBotId" FROM "mcp_servers"
      WHERE "agentBotId" IS NOT NULL AND "endpoint" ~* '^https://mcp\.granola\.ai([:/?#]|$)'
    );
  LOOP
    UPDATE "threads" t SET "meetingTaintedAt" = now()
    WHERE t."meetingTaintedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "messages" m, jsonb_array_elements(m."blocks") e
        WHERE m."threadId" = t."id"
          AND jsonb_typeof(m."blocks") = 'array'
          AND e->>'kind' = 'bot_message_received'
          AND (
            e->>'fromBotId' IN (
              SELECT "agentBotId" FROM "mcp_servers"
              WHERE "agentBotId" IS NOT NULL AND "endpoint" ~* '^https://mcp\.granola\.ai([:/?#]|$)'
            )
            OR e->>'fromBotId' IN (
              SELECT "botId" FROM "threads" WHERE "meetingTaintedAt" IS NOT NULL AND "botId" IS NOT NULL
            )
          )
      );
    GET DIAGNOSTICS changed = ROW_COUNT;
    rounds := rounds + 1;
    EXIT WHEN changed = 0 OR rounds >= 10;
  END LOOP;
END $$;
