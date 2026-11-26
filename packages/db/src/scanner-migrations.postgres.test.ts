import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;
const migrations = [
  "../prisma/migrations/20261231000069_scanner_upload_dedupe/migration.sql",
  "../prisma/migrations/20261231000070_scanner_agent_run/migration.sql",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const schema = `scanner_migrations_${process.pid}`;

describePostgres("Scanner migrations (PostgreSQL)", () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    client = await pool.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE "data_room_items" (
        "id" text PRIMARY KEY,
        "spaceId" text NOT NULL,
        "userId" text NOT NULL,
        "source" text NOT NULL,
        "sha256" text NOT NULL,
        "status" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  });

  afterAll(async () => {
    if (!client) return;
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
    await pool.end();
  });

  it("applies cleanly a second time on a database that already has them", async () => {
    for (const sql of migrations) await client.query(sql);
    // A database that applied the migrations under their old names sees them as new ones.
    for (const sql of migrations) await expect(client.query(sql)).resolves.toBeDefined();

    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'data_room_items' AND column_name = 'scannerRunId'`,
      [schema],
    );
    expect(columns.rows).toHaveLength(1);
    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = 'data_room_items'`,
      [schema],
    );
    expect(indexes.rows.map((row) => row.indexname as string).sort()).toEqual(
      [
        "data_room_items_pkey",
        "data_room_items_scan_sha256_key",
        "data_room_items_spaceId_userId_source_status_scannerRunId_creat",
      ].sort(),
    );
  });
});
