import { afterAll, beforeAll, expect, it } from "vitest";
import { ensureLedger, inTransaction, recordTransaction } from "./ledger.js";
import { listEquityTransactions } from "./securities.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity activity search by security (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("access-activity-search");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("finds a change by its security's label, in the caller's ledger only", async () => {
    const { prisma, mine, otherSpace, owner } = f;
    const holder = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, { type: "individual", name: "Ann Holder" }),
    );
    const cls = await owner.equityShareClass.create({
      data: { ...mine, name: "Common", prefix: "CS", classType: "common" },
    });
    const cert = await owner.equityCertificate.create({
      data: {
        ...mine,
        label: "CS-77",
        stakeholderId: holder.id,
        shareClassId: cls.id,
        quantity: 10n,
        issueDate: new Date("2024-01-01T00:00:00Z"),
      },
    });
    await f.as(mine, () =>
      inTransaction(prisma, async (tx) => {
        await ensureLedger(tx, mine);
        await recordTransaction(tx, mine, {
          kind: "issue",
          effectiveDate: "2024-01-01",
          certificateId: cert.id,
        });
        await recordTransaction(tx, mine, { kind: "modify", effectiveDate: "2024-02-01" });
      }),
    );
    const found = await f.as(mine, () => listEquityTransactions(prisma, mine, { search: "CS-77" }));
    expect(found.items.map((row) => row.kind)).toEqual(["issue"]);
    const other = await f.as(otherSpace, () =>
      listEquityTransactions(prisma, otherSpace, { search: "CS-77" }),
    );
    expect(other.total).toBe(0);
  });
});
