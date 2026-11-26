import { afterAll, beforeAll, expect, it } from "vitest";
import { ensureLedger, inTransaction, recordTransaction } from "./ledger.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity activity actor (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("access-activity");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("records the acting user's name unless the record names someone", async () => {
    const { prisma, mine, owner } = f;
    const [mineId, named] = await f.as(mine, () =>
      inTransaction(prisma, async (tx) => {
        await ensureLedger(tx, mine);
        return [
          await recordTransaction(tx, mine, { kind: "import", effectiveDate: "2024-01-01" }),
          await recordTransaction(tx, mine, {
            kind: "import",
            effectiveDate: "2024-01-01",
            actorName: "Carta import",
          }),
        ];
      }),
    );
    const user = await owner.user.findUniqueOrThrow({ where: { id: mine.userId } });
    const rows = await owner.equityTransaction.findMany({
      where: { id: { in: [mineId!, named!] } },
    });
    const byId = new Map(rows.map((row) => [row.id, row.actorName]));
    expect(byId.get(mineId!)).toBe(user.name);
    expect(byId.get(named!)).toBe("Carta import");
  });
});
