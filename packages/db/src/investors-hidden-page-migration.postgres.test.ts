import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20261220000000_investors_hidden_page/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = `investors_hidden_page_${process.pid}`;

describePostgres("Investors hidden-page migration (PostgreSQL)", () => {
  let pool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    client = await pool.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE "user" ("id" text PRIMARY KEY, "hiddenPages" text[] NOT NULL DEFAULT '{}');
      CREATE TABLE "notifications" ("id" text PRIMARY KEY, "surface" text NOT NULL);
      INSERT INTO "notifications" ("id", "surface") VALUES ('n1', 'cap-table'), ('n2', 'inbox');
      INSERT INTO "user" ("id", "hiddenPages") VALUES
        ('hides-cap-table', ARRAY['legal', 'cap-table']),
        ('hides-other', ARRAY['legal']),
        ('hides-none', '{}');
    `);
  });

  afterAll(async () => {
    await client?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client?.release();
    await pool?.end();
  });

  it("renames a hidden cap-table to investors and leaves the rest alone", async () => {
    await client.query(migration);
    const { rows } = await client.query<{ id: string; hiddenPages: string[] }>(
      `SELECT "id", "hiddenPages" FROM "user" ORDER BY "id"`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.id, row.hiddenPages]))).toEqual({
      "hides-cap-table": ["legal", "investors"],
      "hides-other": ["legal"],
      "hides-none": [],
    });
  });

  it("moves Carta notifications to the investors surface", async () => {
    const { rows } = await client.query(
      `SELECT "id", "surface" FROM "notifications" ORDER BY "id"`,
    );
    expect(rows).toEqual([
      { id: "n1", surface: "investors" },
      { id: "n2", surface: "inbox" },
    ]);
  });
});
