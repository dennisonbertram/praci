import { CapTableSnapshotSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { importEquitySnapshot } from "./import.js";
import { createEquityWarrant } from "./options-warrants.js";
import { equityLedgerSnapshot } from "./overview.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("ledger-derived snapshot size and warrants (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("derived");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("returns every holder of a 600-holder ledger and lists warrants", async () => {
    const { prisma, mine } = f;
    const holders = Array.from({ length: 600 }, (_, i) => ({
      name: `Holder ${String(i).padStart(3, "0")}`,
      email: `holder${i}@example.test`,
      organization: null,
      security: "Common",
      shares: 1_000 + i,
      amountUsd: null,
      percent: null,
    }));
    // Importing 600 holders can pass Prisma's 5 s default under load; give this setup more room.
    const slowImport = new Proxy(prisma, {
      get: (target, key) =>
        key === "$transaction"
          ? (fn: never, options?: object) =>
              target.$transaction(fn, { ...options, timeout: 60_000 })
          : Reflect.get(target, key),
    });
    await f.as(mine, () =>
      importEquitySnapshot(slowImport, mine, {
        companyName: "Example Robotics",
        asOf: "2026-01-31",
        fullyDilutedShares: 2_000_000,
        source: "native",
        sourceRef: null,
        amountRaisedUsd: null,
        optionPoolAvailable: null,
        latest409a: null,
        shareClasses: [{ name: "Common", shares: 2_000_000, percent: 100 }],
        holders,
        updatedAt: new Date().toISOString(),
        canUndo: false,
      }),
    );
    const holder = await f.as(mine, () =>
      prisma.equityStakeholder.findFirstOrThrow({ where: { ...mine, name: "Holder 000" } }),
    );
    const common = await f.as(mine, () =>
      prisma.equityShareClass.findFirstOrThrow({ where: mine }),
    );
    await f.as(mine, () =>
      createEquityWarrant(prisma, mine, {
        stakeholderId: holder.id,
        shareClassId: common.id,
        quantity: "5000",
        exercisePrice: "0.10",
        issueDate: "2026-01-01",
      }),
    );

    const derived = CapTableSnapshotSchema.parse(
      await f.as(mine, () => equityLedgerSnapshot(prisma, mine)),
    );
    expect(derived.holders.filter((row) => row.security === "Common")).toHaveLength(600);
    expect(derived.holders.find((row) => row.security === "Warrant")).toMatchObject({
      name: "Holder 000",
      shares: 5000,
    });
    // The base includes the 5,000 warrant shares, so the percents never add past 100.
    const sharesHeld = derived.holders.reduce((sum, row) => sum + (row.shares ?? 0), 0);
    expect(derived.fullyDilutedShares).toBe(sharesHeld);
    const warrant = derived.holders.find((row) => row.security === "Warrant");
    expect(warrant?.percent).toBeCloseTo((5000 / sharesHeld) * 100, 3);
    expect(derived.holders.reduce((sum, row) => sum + (row.percent ?? 0), 0)).toBeLessThanOrEqual(
      100.01,
    );
  });
});
