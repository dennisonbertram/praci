import { readdirSync, readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && migrationUrl ? describe.sequential : describe.skip;

const MIGRATIONS = new URL("../prisma/migrations/", import.meta.url);
const TARGET = "20261231000057_pipeline_import_rows";
const sqlOf = (name: string) => readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS), "utf8");

// A scratch database at the schema before migration 057, with rows the old schema allowed.
describePostgres("migration 057 on a database with imports (PostgreSQL)", () => {
  const database = `imp_mig_${process.pid}_${Date.now()}`;
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: migrationUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
    const url = new URL(migrationUrl as string);
    url.pathname = `/${database}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
    const earlier = readdirSync(MIGRATIONS)
      .filter((name) => /^\d/.test(name) && name < TARGET)
      .sort();
    // `prisma migrate deploy` makes this table first; an early migration reads it.
    await db.query(`CREATE TABLE "_prisma_migrations" (
      id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0
    )`);
    for (const name of earlier) await db.query(sqlOf(name));

    await db.query(`
      INSERT INTO "user" (id, name, email, "updatedAt") VALUES ('u1', 'u1', 'u1@example.test', now());
      INSERT INTO organization (id, name, slug, "createdAt") VALUES ('o1', 'o1', 'o1', now());
      INSERT INTO spaces (id, "organizationId", name) VALUES ('s1', 'o1', 's1');
      INSERT INTO pipeline_imports (id, "spaceId", "userId", rows, status, "cardMessageId", "updatedAt") VALUES
        ('staged-1', 's1', 'u1', '[{"firm":"Invented One"},{"firm":"Invented One"},{"firm":"Invented Two"}]', 'staging', NULL, now()),
        ('staged-2', 's1', 'u1', '[{"firm":"Invented Three"}]', 'reviewing', 'message-1', now()),
        ('mid-way', 's1', 'u1', '[{"firm":"Invented Four"}]', 'applying', NULL, now()),
        ('finished', 's1', 'u1', '[]', 'done', NULL, now()),
        ('not-a-list', 's1', 'u1', '{"oops":true}', 'staging', NULL, now());
    `);
    await db.query(sqlOf(TARGET));
  }, 120_000);
  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin?.end();
  });

  it("closes every import that was not finished, and leaves a finished one", async () => {
    const { rows } = await db.query(`SELECT id, status FROM pipeline_imports ORDER BY id`);
    expect(rows).toEqual([
      { id: "finished", status: "done" },
      { id: "mid-way", status: "discarded" },
      { id: "not-a-list", status: "discarded" },
      { id: "staged-1", status: "discarded" },
      { id: "staged-2", status: "discarded" },
    ]);
  });

  it("keeps every staged row on its closed import, duplicates included", async () => {
    const { rows } = await db.query(
      `SELECT "importId", position, data->>'firm' AS firm, state, "spaceId", "userId"
       FROM pipeline_import_rows ORDER BY "importId", position`,
    );
    const firmsOf = (id: string) =>
      rows.filter((row) => row.importId === id).map((row) => row.firm);
    expect(firmsOf("staged-1")).toEqual(["Invented One", "Invented One", "Invented Two"]);
    expect(firmsOf("staged-2")).toEqual(["Invented Three"]);
    expect(firmsOf("mid-way")).toEqual(["Invented Four"]);
    expect(firmsOf("not-a-list")).toEqual([]);
    expect(rows.every((row) => row.spaceId === "s1" && row.userId === "u1")).toBe(true);
    expect(rows.every((row) => row.state === "staged")).toBe(true);
  });

  it("gives a message id no place as an effect id", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM pipeline_imports WHERE "effectId" IS NOT NULL`,
    );
    expect(rows[0].n).toBe(0);
  });

  it("then allows one open import per user, and not a second", async () => {
    await db.query(
      `INSERT INTO pipeline_imports (id, "spaceId", "userId", "updatedAt") VALUES ('new-1', 's1', 'u1', now())`,
    );
    await expect(
      db.query(
        `INSERT INTO pipeline_imports (id, "spaceId", "userId", "updatedAt") VALUES ('new-2', 's1', 'u1', now())`,
      ),
    ).rejects.toThrow(/pipeline_imports_one_open_key/);
  });
});
