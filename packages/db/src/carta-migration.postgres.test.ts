import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20261028000000_carta_integration_agent/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = `carta_migration_${process.pid}`;

describePostgres("Carta integration-agent migration (PostgreSQL)", () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    client = await pool.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE "bots" (
        "id" text PRIMARY KEY,
        "spaceId" text NOT NULL,
        "userId" text NOT NULL,
        "spawnKey" text,
        "archivedAt" timestamptz
      );
      CREATE TABLE "mcp_servers" (
        "id" text PRIMARY KEY,
        "spaceId" text NOT NULL,
        "userId" text NOT NULL,
        "endpoint" text,
        "agentBotId" text,
        "agentExclusive" boolean NOT NULL DEFAULT false,
        "writesEnabled" boolean NOT NULL DEFAULT false
      );
      CREATE TABLE "bot_mcp_servers" (
        "id" text PRIMARY KEY,
        "botId" text NOT NULL,
        "serverId" text NOT NULL,
        "allowedTools" jsonb NOT NULL
      );
      INSERT INTO "bots" ("id", "spaceId", "userId", "spawnKey", "archivedAt") VALUES
        ('bot-one', 'space-one', 'user-one', 'carta-agent:user-one', NULL),
        ('bot-two', 'space-two', 'user-one', 'carta-agent:user-one', NULL),
        ('bot-wrong-owner', 'space-one', 'user-other', 'carta-agent:user-one', NULL),
        ('bot-archived', 'space-one', 'user-archived', 'carta-agent:user-archived', now());
      INSERT INTO "mcp_servers"
        ("id", "spaceId", "userId", "endpoint", "agentBotId", "agentExclusive", "writesEnabled") VALUES
        ('server-one', 'space-one', 'user-one', 'https://mcp.app.carta.com/mcp', NULL, false, true),
        ('server-two', 'space-two', 'user-one', 'https://mcp.app.carta.com:443/mcp', NULL, false, true),
        ('server-wrong-owner', 'space-one', 'user-other', 'https://mcp.app.carta.com/mcp', NULL, false, true),
        ('server-archived', 'space-one', 'user-archived', 'https://mcp.app.carta.com/mcp', NULL, false, true),
        ('server-missing', 'space-one', 'user-missing', 'https://mcp.app.carta.com/mcp', NULL, false, true),
        ('server-spoof', 'space-one', 'user-one', 'https://mcp.app.carta.com.evil.test/mcp', 'legacy-link', true, true);
      INSERT INTO "bot_mcp_servers" ("id", "botId", "serverId", "allowedTools") VALUES
        ('assignment-one', 'other-bot', 'server-one', '["custom-read"]'),
        ('assignment-two', 'other-bot', 'server-two', '["custom-write"]');
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
      client.release();
    }
    await pool?.end();
  });

  it("links only live same-owner agents, resets writes and preserves assignment rows", async () => {
    const before = await client.query(`
      SELECT server."agentBotId", bot."id" AS "expectedBotId"
      FROM "mcp_servers" AS server
      JOIN "bots" AS bot
        ON bot."spaceId" = server."spaceId"
       AND bot."userId" = server."userId"
       AND bot."spawnKey" = 'carta-agent:' || server."userId"
       AND bot."archivedAt" IS NULL
      WHERE server."id" = 'server-one'
    `);
    expect(before.rows).toEqual([{ agentBotId: null, expectedBotId: "bot-one" }]);

    await client.query(migration);

    const servers = await client.query(`
      SELECT "id", "agentBotId", "agentExclusive", "writesEnabled"
      FROM "mcp_servers"
      ORDER BY "id"
    `);
    expect(servers.rows).toEqual([
      {
        id: "server-archived",
        agentBotId: null,
        agentExclusive: false,
        writesEnabled: false,
      },
      {
        id: "server-missing",
        agentBotId: null,
        agentExclusive: false,
        writesEnabled: false,
      },
      {
        id: "server-one",
        agentBotId: "bot-one",
        agentExclusive: true,
        writesEnabled: false,
      },
      {
        id: "server-spoof",
        agentBotId: "legacy-link",
        agentExclusive: true,
        writesEnabled: true,
      },
      {
        id: "server-two",
        agentBotId: "bot-two",
        agentExclusive: true,
        writesEnabled: false,
      },
      {
        id: "server-wrong-owner",
        agentBotId: null,
        agentExclusive: false,
        writesEnabled: false,
      },
    ]);
    const assignments = await client.query(`
      SELECT "id", "botId", "serverId", "allowedTools"
      FROM "bot_mcp_servers"
      ORDER BY "id"
    `);
    expect(assignments.rows).toEqual([
      {
        id: "assignment-one",
        botId: "other-bot",
        serverId: "server-one",
        allowedTools: ["custom-read"],
      },
      {
        id: "assignment-two",
        botId: "other-bot",
        serverId: "server-two",
        allowedTools: ["custom-write"],
      },
    ]);
  });
});
