import { CapTableSnapshotSchema, EquityOverviewSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getCapTableSnapshot, saveCapTableSnapshot } from "../cap-table.js";
import { importEquitySnapshot } from "./import.js";
import { EquityConflictError } from "./ledger.js";
import { equityLedgerSnapshot, equityOverview } from "./overview.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { createTestNsoGrant } from "./views-test-data.js";

const snapshot = {
  companyName: "Example Robotics",
  asOf: "2026-01-31",
  fullyDilutedShares: 12_000_000,
  optionPoolAvailable: 1_500_000,
  latest409a: { pricePerShareUsd: 0.42, date: "2025-12-01" },
  shareClasses: [
    { name: "Common", shares: 8_000_000, percent: 66.67 },
    { name: "Series Seed Preferred", shares: 2_500_000, percent: 20.83 },
  ],
  holders: [
    { name: "Ada Founder", email: "ada@example.test", security: "Common", shares: 5_000_000 },
    { name: "Ben Founder", email: "ben@example.test", security: "Common", shares: 3_000_000 },
    {
      name: "Example Ventures",
      organization: "Example Ventures",
      security: "Series Seed Preferred",
      shares: 2_500_000,
      amountUsd: 2_000_000,
    },
    { name: "Dee Angel", security: "SAFE", amountUsd: 250_000 },
  ],
};

describeEquityPostgres("equity overview, import and derived snapshot (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("overview");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("starts empty, offers the import once a snapshot exists, and copies it once", async () => {
    const { prisma, mine } = f;
    const empty = await f.as(mine, () => equityOverview(prisma, mine));
    expect(EquityOverviewSchema.parse(empty)).toMatchObject({ hasLedger: false, canImport: false });
    expect(await f.as(mine, () => equityLedgerSnapshot(prisma, mine))).toBeNull();

    await f.as(mine, () => saveCapTableSnapshot(prisma, mine, snapshot));
    expect((await f.as(mine, () => equityOverview(prisma, mine))).canImport).toBe(true);

    const stored = (await f.as(mine, () => getCapTableSnapshot(prisma, mine)))!;
    const unsafeShares = {
      ...stored,
      holders: stored.holders.map((holder) => ({
        ...holder,
        ...(holder.name === "Ada Founder" ? { shares: Number.MAX_SAFE_INTEGER + 1 } : {}),
      })),
    };
    await expect(
      f.as(mine, () => importEquitySnapshot(prisma, mine, unsafeShares)),
    ).rejects.toThrow("Share quantity is outside the PostgreSQL BIGINT range");
    const unsafeAmount = {
      ...stored,
      holders: stored.holders.map((holder) => ({
        ...holder,
        ...(holder.name === "Dee Angel" ? { amountUsd: Number.MAX_SAFE_INTEGER } : {}),
      })),
    };
    await expect(
      f.as(mine, () => importEquitySnapshot(prisma, mine, unsafeAmount)),
    ).rejects.toThrow("Amount is outside the PostgreSQL BIGINT range");
    expect(await f.as(mine, () => equityLedgerSnapshot(prisma, mine))).toBeNull();

    const result = await f.as(mine, () => importEquitySnapshot(prisma, mine, stored));
    expect(result).toEqual({
      stakeholders: 4,
      shareClasses: 2,
      plans: 1,
      certificates: 3,
      convertibles: 1,
      optionGrants: 0,
    });
    await createTestNsoGrant(f, mine, {
      holderName: "Cy Engineer",
      quantity: 1_000_000,
      exercisePrice: "0.42",
      grantDate: snapshot.asOf,
    });
    await expect(
      f.as(mine, () => importEquitySnapshot(prisma, mine, stored)),
    ).rejects.toBeInstanceOf(EquityConflictError);

    const overview = EquityOverviewSchema.parse(
      await f.as(mine, () => equityOverview(prisma, mine)),
    );
    expect(overview).toMatchObject({ hasLedger: true, canImport: false });
    expect(overview.importedAt).not.toBeNull();
    expect(overview.totals).toEqual({
      outstandingShares: "10500000",
      // 10.5M issued + 1M options + 0.5M left in the pool
      fullyDilutedShares: "12000000",
      commonShares: "8000000",
      preferredShares: "2500000",
      availablePlanShares: "500000",
      amountRaisedCents: "225000000",
    });
    expect(overview.classes.map((row) => [row.name, row.fullyDilutedPercent])).toEqual([
      ["Series Seed Preferred", "20.8333"],
      ["Common", "79.1667"],
    ]);
    expect(overview.convertibles).toEqual([
      expect.objectContaining({ name: "Convertibles", principalCents: "25000000" }),
    ]);

    const derived = CapTableSnapshotSchema.parse(
      await f.as(mine, () => equityLedgerSnapshot(prisma, mine)),
    );
    expect(derived).toMatchObject({
      companyName: "Example Robotics",
      fullyDilutedShares: 12_000_000,
      source: "native",
      optionPoolAvailable: 500_000,
      amountRaisedUsd: 2_250_000,
      latest409a: { pricePerShareUsd: 0.42 },
    });
    expect(derived.holders[0]).toMatchObject({
      name: "Ada Founder",
      security: "Common",
      shares: 5_000_000,
    });
    expect(derived.holders.find((holder) => holder.security === "Option")).toMatchObject({
      name: "Cy Engineer",
      shares: 1_000_000,
    });
    expect(derived.holders.find((holder) => holder.security === "SAFE")).toMatchObject({
      name: "Dee Angel",
      amountUsd: 250_000,
      shares: null,
    });
  });

  it("keeps the ledger to its owner", async () => {
    const { prisma, sameSpace, otherSpace } = f;
    for (const other of [sameSpace, otherSpace]) {
      const overview = await f.as(other, () => equityOverview(prisma, other));
      expect(overview.hasLedger).toBe(false);
      expect(overview.counts.stakeholders).toBe(0);
      expect(await f.as(other, () => equityLedgerSnapshot(prisma, other))).toBeNull();
    }
  });
});
