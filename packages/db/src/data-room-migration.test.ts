import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("data room migration", () => {
  it("fails with a clear message before CREATE EXTENSION when the image lacks pgvector", () => {
    const sql = readFileSync(
      new URL("../prisma/migrations/20261020000000_data_room/migration.sql", import.meta.url),
      "utf8",
    );
    const guard = sql.indexOf("pg_available_extensions");
    expect(guard).toBeGreaterThan(-1);
    expect(sql).toContain("RAISE EXCEPTION 'The database image must include pgvector");
    expect(sql).toContain("prisma migrate resolve --rolled-back 20261020000000_data_room");
    expect(guard).toBeLessThan(sql.indexOf("CREATE EXTENSION IF NOT EXISTS vector"));
  });
});
