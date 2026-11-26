import { EquityHealthRunResultSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { runEquityHealthChecks } from "./views-health.js";
import { seedViewsTestLedger } from "./views-test-data.js";

describeEquityPostgres("equity health checks (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("views-health");
    await seedViewsTestLedger(f, f.mine);
  });
  afterAll(async () => {
    await f?.close();
  });

  it("records findings, keeps a dismissed one dismissed, and resolves fixed ones", async () => {
    const { prisma, mine, owner } = f;
    const first = EquityHealthRunResultSchema.parse(
      await f.as(mine, () => runEquityHealthChecks(prisma, mine)),
    );
    // The holders without an email (Cy Engineer, Dee Angel, Example Ventures).
    const findings = await owner.equityHealthFinding.findMany({ where: mine });
    const email = findings.find((row) => row.check === "holder-missing-email")!;
    expect(email.severity).toBe("recommended");
    expect(
      (email.rows as { recordKind: string }[]).every((row) => row.recordKind === "stakeholder"),
    ).toBe(true);
    expect(first.open).toBe(findings.length);

    await owner.equityHealthFinding.update({
      where: { id: email.id },
      data: { status: "dismissed" },
    });
    await f.as(mine, () => runEquityHealthChecks(prisma, mine));
    expect((await owner.equityHealthFinding.findUnique({ where: { id: email.id } }))?.status).toBe(
      "dismissed",
    );

    await owner.equityStakeholder.updateMany({ where: { ...mine }, data: { contactEmail: null } });
    await owner.equityHealthFinding.update({ where: { id: email.id }, data: { status: "open" } });
    const third = await f.as(mine, () => runEquityHealthChecks(prisma, mine));
    expect(third.resolved).toBe(1);
    expect((await owner.equityHealthFinding.findUnique({ where: { id: email.id } }))?.status).toBe(
      "resolved",
    );
  });

  it("reruns a single check without touching the others", async () => {
    const { prisma, mine, owner } = f;
    await f.as(mine, () => runEquityHealthChecks(prisma, mine));
    const before = await owner.equityHealthFinding.findMany({
      where: mine,
      orderBy: { id: "asc" },
    });
    const other = before.find(
      (row) => row.check !== "holder-missing-email" && row.status === "open",
    );
    const result = await f.as(mine, () =>
      runEquityHealthChecks(prisma, mine, { check: "holder-missing-email" }),
    );
    expect(result.resolved).toBe(0);
    if (other) {
      const after = await owner.equityHealthFinding.findUnique({ where: { id: other.id } });
      expect(after?.updatedAt.getTime()).toBe(other.updatedAt.getTime());
    }
  });

  it("checks only the caller's ledger", async () => {
    const { prisma, sameSpace, otherSpace, owner } = f;
    for (const scope of [sameSpace, otherSpace]) {
      const result = await f.as(scope, () => runEquityHealthChecks(prisma, scope));
      expect(result.open).toBe(0);
      expect(await owner.equityHealthFinding.count({ where: scope })).toBe(0);
    }
  });
});
