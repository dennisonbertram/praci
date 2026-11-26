import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeEquityPostgres } from "./test-fixture.js";

describeEquityPostgres("equity convertible closure migration (PostgreSQL)", () => {
  let client: Client | undefined;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error("PostgreSQL test connection is required");
    const url = new URL(connectionString);
    url.searchParams.delete("schema");
    client = new Client({ connectionString: url.toString() });
    await client.connect();
  });

  afterAll(async () => client?.end());

  it("leaves generic repayment dates unknown and keeps dated cancellation/conversion evidence", async () => {
    await client!.query(`
      CREATE TEMP TABLE "equity_convertibles" (
        "id" text PRIMARY KEY,
        "spaceId" text NOT NULL,
        "userId" text NOT NULL,
        "status" text NOT NULL,
        "issueDate" date NOT NULL,
        "canceledOn" date,
        "convertedToId" text
      );
      CREATE TEMP TABLE "equity_transactions" (
        "id" text PRIMARY KEY,
        "spaceId" text NOT NULL,
        "userId" text NOT NULL,
        "convertibleId" text NOT NULL,
        "kind" text NOT NULL,
        "effectiveDate" date NOT NULL,
        "before" jsonb,
        "after" jsonb,
        "createdAt" timestamptz NOT NULL
      );
      CREATE TEMP TABLE "equity_certificates" (
        "id" text PRIMARY KEY,
        "spaceId" text NOT NULL,
        "userId" text NOT NULL,
        "issueDate" date NOT NULL
      );
      INSERT INTO "equity_convertibles" VALUES
        ('legacy-repaid', 'space-a', 'user-a', 'repaid', '2024-01-01', NULL, NULL),
        ('explicit-repaid', 'space-a', 'user-a', 'repaid', '2024-01-01', NULL, NULL),
        ('canceled', 'space-a', 'user-a', 'canceled', '2024-01-01', '2024-06-01', NULL),
        ('cancel-audit', 'space-a', 'user-a', 'canceled', '2024-01-01', NULL, NULL),
        ('converted', 'space-a', 'user-a', 'converted', '2024-01-01', NULL, 'cert-a');
      INSERT INTO "equity_certificates" VALUES ('cert-a', 'space-a', 'user-a', '2025-01-01');
      INSERT INTO "equity_transactions" VALUES
        ('tx-repaid', 'space-a', 'user-a', 'legacy-repaid', 'modify', '2025-03-01',
          '{"status":"outstanding"}', '{"status":"repaid"}', '2025-03-01'),
        ('tx-explicit-repaid', 'space-a', 'user-a', 'explicit-repaid', 'modify', '2025-03-01',
          '{"status":"outstanding","closedOn":null}',
          '{"status":"repaid","closedOn":"2024-12-31"}', '2025-03-01'),
        ('tx-canceled-metadata', 'space-a', 'user-a', 'canceled', 'modify', '2025-01-01',
          '{"status":"canceled"}', '{"status":"canceled"}', '2025-01-01'),
        ('tx-cancel', 'space-a', 'user-a', 'cancel-audit', 'cancel', '2024-08-01',
          '{"status":"outstanding"}', '{"status":"canceled"}', '2024-08-01'),
        ('tx-convert', 'space-a', 'user-a', 'converted', 'convert', '2024-06-01',
          '{"status":"outstanding"}', '{"status":"converted"}', '2024-06-01'),
        ('tx-convert-metadata', 'space-a', 'user-a', 'converted', 'modify', '2025-02-01',
          '{"status":"converted"}', '{"status":"converted"}', '2025-02-01');
    `);

    const migration = await readFile(
      new URL(
        "../../prisma/migrations/20261231000104_equity_convertible_closed_on/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await client!.query(migration);

    const result = await client!.query(
      'SELECT "id", "closedOn"::text AS "closedOn" FROM "equity_convertibles" ORDER BY "id"',
    );
    expect(Object.fromEntries(result.rows.map((row) => [row.id, row.closedOn]))).toEqual({
      "cancel-audit": "2024-08-01",
      canceled: "2024-06-01",
      converted: "2024-06-01",
      "explicit-repaid": "2024-12-31",
      "legacy-repaid": null,
    });
    await expect(
      client!.query(
        `UPDATE "equity_convertibles" SET "closedOn" = DATE '2023-12-31' WHERE "id" = 'legacy-repaid'`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
