import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { increaseEquityPlanPool } from "./options-plans.js";
import { equityLedgerSnapshot, loadLedger } from "./overview.js";
import { createEquityPlan } from "./share-classes.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const backfill = readFileSync(
  new URL(
    "../../prisma/migrations/20261231000156_equity_child_consideration_backfill/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describeEquityPostgres("pool as of a date, ratio percents and consideration backfill", () => {
  let f: EquityFixture;
  let scope: { spaceId: string; userId: string };
  let holderId = "";
  let otherId = "";
  let commonId = "";
  let preferredId = "";

  beforeAll(async () => {
    f = await equityFixture("pool-backfill");
    scope = { spaceId: f.mine.spaceId, userId: f.mine.userId };
    await f.owner.equityLedger.create({ data: scope });
    const person = async (name: string) =>
      (await f.owner.equityStakeholder.create({ data: { ...scope, type: "individual", name } })).id;
    holderId = await person("Ada Example");
    otherId = await person("Ben Sample");
    const makeClass = async (name: string, prefix: string, classType: string, ratio: string) => {
      const row = await f.owner.equityShareClass.create({
        data: { ...scope, name, prefix, classType },
      });
      await f.owner.equityShareClassVersion.create({
        data: {
          ...scope,
          shareClassId: row.id,
          documentDate: day("2022-01-01"),
          authorizedShares: 1_000_000n,
          conversionRatio: ratio,
        },
      });
      return row.id;
    };
    commonId = await makeClass("Common", "CS", "common", "1");
    preferredId = await makeClass("Series A Preferred", "PA", "preferred", "2");
  });

  afterAll(async () => {
    await f?.close();
  });

  it("reads the pool as it stood on the date, not today's reserve", async () => {
    const plan = await f.as(f.mine, () =>
      createEquityPlan(f.prisma, f.mine, {
        name: "2023 Plan",
        shareClassId: commonId,
        reservedShares: "600",
        boardApprovedOn: "2023-01-01",
      }),
    );
    await f.as(f.mine, () =>
      increaseEquityPlanPool(f.prisma, f.mine, {
        planId: plan.id,
        shares: "400",
        effectiveDate: "2024-06-01",
      }),
    );
    const available = async (asOf: string) => {
      const { input } = await f.as(f.mine, () => loadLedger(f.prisma, f.mine, asOf));
      const { computeCapTable } = await import("@rakazo/core/equity");
      return computeCapTable(input).totals.availablePlanShares;
    };
    expect(await available("2022-12-31")).toBe(0n);
    expect(await available("2024-01-01")).toBe(600n);
    expect(await available("2024-06-01")).toBe(1_000n);
  });

  it("gives each holder's percent of fully diluted with the class at its ratio", async () => {
    const issue = (stakeholderId: string, shareClassId: string, quantity: number, label: string) =>
      f.owner.equityCertificate.create({
        data: {
          ...scope,
          stakeholderId,
          shareClassId,
          label,
          quantity: BigInt(quantity),
          status: "outstanding",
          issueDate: day("2023-01-01"),
        },
      });
    await issue(holderId, commonId, 100, "CS-R1");
    await issue(otherId, preferredId, 50, "PA-R1");
    // Any pool shares already in the ledger count in the total, so the test reads the total from
    // the snapshot instead of assuming what other tests left: Common counts 100 and Series A
    // Preferred counts 50 x 2 = 100 fully diluted shares.
    const snapshot = await f.as(f.mine, () => equityLedgerSnapshot(f.prisma, f.mine));
    const holder = (security: string) => snapshot?.holders.find((row) => row.security === security);
    const total = snapshot?.fullyDilutedShares ?? 0;
    expect(total).toBeGreaterThanOrEqual(200);
    expect(holder("Common")?.percent).toBeCloseTo((100 / total) * 100, 3);
    expect(holder("Series A Preferred")?.shares).toBe(50);
    expect(holder("Series A Preferred")?.percent).toBeCloseTo((100 / total) * 100, 3);
  });

  it("apportions a parent's consideration to old zero-consideration children, exactly and once", async () => {
    const make = (
      label: string,
      quantity: number,
      over: Record<string, unknown> = {},
    ): Promise<{ id: string }> =>
      f.owner.equityCertificate.create({
        data: {
          ...scope,
          stakeholderId: holderId,
          shareClassId: commonId,
          label,
          quantity: BigInt(quantity),
          status: "outstanding",
          issueDate: day("2023-01-01"),
          ...over,
        },
      });
    // A transfer of 3 shares into 1 + 2, and a partial cancel of 1 of 3 that left a child of 2.
    const transferred = await make("CS-B1", 3, {
      status: "transferred",
      cashPaidCents: 100n,
      otherConsiderationCents: 5n,
    });
    const first = await make("CS-B2", 1, { parentId: transferred.id });
    const second = await make("CS-B3", 2, { parentId: transferred.id });
    const canceled = await make("CS-B4", 3, { status: "canceled", cashPaidCents: 100n });
    const remainder = await make("CS-B5", 2, { parentId: canceled.id });
    // A parent whose child already carries consideration is left alone.
    const done = await make("CS-B6", 2, { status: "transferred", cashPaidCents: 50n });
    const kept = await make("CS-B7", 2, { parentId: done.id, cashPaidCents: 7n });

    // A chain of old-shape rows: 4 shares of 100 cents go to 3 + 1, and the 3 go on to 2 + 1.
    const root = await make("CS-C1", 4, { status: "transferred", cashPaidCents: 100n });
    const middle = await make("CS-C2", 3, { parentId: root.id, status: "transferred" });
    const leafA = await make("CS-C3", 2, { parentId: middle.id });
    const leafB = await make("CS-C4", 1, { parentId: middle.id });
    const sibling = await make("CS-C5", 1, { parentId: root.id });

    const cents = async (id: string) => {
      const row = await f.owner.equityCertificate.findUniqueOrThrow({ where: { id } });
      return [row.cashPaidCents, row.otherConsiderationCents];
    };
    expect(await cents(first.id)).toEqual([0n, 0n]);

    await f.owner.$executeRawUnsafe(backfill);
    // The grandchildren get their share of what the middle certificate was just given: 75, then 50 and 25.
    expect(await cents(middle.id)).toEqual([75n, 0n]);
    expect(await cents(sibling.id)).toEqual([25n, 0n]);
    expect(await cents(leafA.id)).toEqual([50n, 0n]);
    expect(await cents(leafB.id)).toEqual([25n, 0n]);
    // 100 over thirds is 33 and 67, 5 over thirds is 2 and 3: the largest remainder takes the spare cent.
    expect(await cents(first.id)).toEqual([33n, 2n]);
    expect(await cents(second.id)).toEqual([67n, 3n]);
    // The canceled share keeps its third: 100 over 2 + 1 shares is 67 and 33.
    expect(await cents(remainder.id)).toEqual([67n, 0n]);
    expect(await cents(kept.id)).toEqual([7n, 0n]);

    await f.owner.$executeRawUnsafe(backfill);
    expect(await cents(first.id)).toEqual([33n, 2n]);
    expect(await cents(second.id)).toEqual([67n, 3n]);
    expect(await cents(leafA.id)).toEqual([50n, 0n]);
  });
});
