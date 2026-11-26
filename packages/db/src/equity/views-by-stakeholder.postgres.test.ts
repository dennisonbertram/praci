import { EquityCapTableByStakeholderSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { equityOverview } from "./overview.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { equityCapTableByStakeholder } from "./views-by-stakeholder.js";
import { seedViewsTestLedger } from "./views-test-data.js";

describeEquityPostgres("equity cap table by stakeholder (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("views-by-stakeholder");
    await seedViewsTestLedger(f, f.mine);
  });
  afterAll(async () => {
    await f?.close();
  });

  it("lists every holder with shares per class, options, convertibles and securities", async () => {
    const { prisma, mine } = f;
    const view = EquityCapTableByStakeholderSchema.parse(
      await f.as(mine, () => equityCapTableByStakeholder(prisma, mine)),
    );
    expect(view.rows.map((row) => row.name)).toEqual([
      "Ada Founder",
      "Ben Founder",
      "Example Ventures",
      "Cy Engineer",
      "Dee Angel",
    ]);
    const overview = await f.as(mine, () => equityOverview(prisma, mine));
    expect(view.totals.outstandingShares).toBe(overview.totals.outstandingShares);
    const cy = view.rows.find((row) => row.name === "Cy Engineer")!;
    expect(cy.options).toBe("1000000");
    expect(cy.securities[0]?.kind).toBe("option_grant");
    const dee = view.rows.find((row) => row.name === "Dee Angel")!;
    expect(dee.convertiblePrincipalCents).toBe("25000000");
    const ada = view.rows[0]!;
    expect(Object.values(ada.sharesByClass)).toEqual(["5000000"]);
    expect(ada.securities).toHaveLength(1);
  });

  it("shows nothing of another user's or another space's ledger", async () => {
    const { prisma, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace]) {
      const view = await f.as(scope, () => equityCapTableByStakeholder(prisma, scope));
      expect(view.rows).toEqual([]);
      expect(view.classes).toEqual([]);
    }
  });

  it("refuses a bad date", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () => equityCapTableByStakeholder(prisma, mine, { asOf: "2026-13-40" })),
    ).rejects.toThrow();
  });
});
