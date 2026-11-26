import { EQUITY_REPORT_KINDS, EquityReportSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { equityOverview } from "./overview.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { equityReport, equityReportHistory } from "./views-reports.js";
import { seedViewsTestLedger } from "./views-test-data.js";

describeEquityPostgres("equity reports (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("views-reports");
    await seedViewsTestLedger(f, f.mine);
  });
  afterAll(async () => {
    await f?.close();
  });

  it("builds every report as a table and matching CSV", async () => {
    const { prisma, mine } = f;
    for (const kind of EQUITY_REPORT_KINDS) {
      const result = EquityReportSchema.parse(
        await f.as(mine, () => equityReport(prisma, mine, { kind })),
      );
      expect(result.rows.length, kind).toBeGreaterThan(0);
      expect(result.csv.split("\r\n")[0]).toBe(result.columns.map((c) => c.label).join(","));
      expect(result.csv.trimEnd().split("\r\n")).toHaveLength(result.rows.length + 1);
    }
  });

  it("applies the cap table report options", async () => {
    const { prisma, mine } = f;
    const byClass = await f.as(mine, () =>
      equityReport(prisma, mine, {
        kind: "cap_table",
        fullyDiluted: false,
        includeConvertibles: false,
      }),
    );
    expect(byClass.columns.find((c) => c.key === "shares")?.label).toBe("Outstanding shares");
    expect(byClass.rows.map((row) => row.name)).not.toContain("Available for grant");
    const byHolder = await f.as(mine, () =>
      equityReport(prisma, mine, { kind: "cap_table", groupBy: "stakeholder" }),
    );
    expect(byHolder.rows[0]?.stakeholder).toBe("Ada Founder");
    expect(byHolder.rows.map((row) => row.stakeholder)).toContain("Dee Angel");
    const option = await f.as(mine, () => equityReport(prisma, mine, { kind: "option_holders" }));
    expect(option.rows[0]).toMatchObject({ stakeholder: "Cy Engineer", granted: "1000000" });
  });

  it("adds up to the overview's totals for the same ledger and date", async () => {
    const { prisma, mine } = f;
    const asOf = "2026-06-30";
    const overview = await f.as(mine, () => equityOverview(prisma, mine, { asOf }));
    const options = overview.plans.reduce((sum, plan) => sum + BigInt(plan.outstandingShares), 0n);
    expect(options).toBeGreaterThan(0n);
    for (const fullyDiluted of [true, false]) {
      const total = fullyDiluted
        ? overview.totals.fullyDilutedShares
        : overview.totals.outstandingShares;
      for (const groupBy of ["share_class", "stakeholder"] as const) {
        const result = await f.as(mine, () =>
          equityReport(prisma, mine, { kind: "cap_table", asOf, groupBy, fullyDiluted }),
        );
        const label = `${groupBy} fullyDiluted=${fullyDiluted}`;
        const nameKey = groupBy === "stakeholder" ? "stakeholder" : "name";
        const totalRow = result.rows.at(-1)!;
        const body = result.rows.slice(0, -1);
        expect(totalRow, label).toMatchObject({
          [nameKey]: "Total",
          shares: total,
          percent: "100.0000",
        });
        const shares = body.reduce((sum, row) => sum + BigInt(row.shares ?? "0"), 0n);
        expect(shares.toString(), label).toBe(total);
        const percent = body.reduce((sum, row) => sum + Number(row.percent ?? "0"), 0);
        expect(Math.abs(percent - 100), label).toBeLessThan(0.005);
        expect(result.csv.trimEnd().split("\r\n").at(-1), label).toContain(`Total,`);
        if (groupBy === "share_class") {
          for (const row of overview.classes)
            expect(body.find((r) => r.name === row.name)?.shares, label).toBe(
              row.outstandingShares,
            );
          const byName = (name: string) => body.find((row) => row.name === name)?.shares;
          expect(byName("Options granted"), label).toBe(
            fullyDiluted ? options.toString() : undefined,
          );
          expect(byName("Available for grant"), label).toBe(
            fullyDiluted ? overview.totals.availablePlanShares : undefined,
          );
        }
      }
    }
  });

  it("shows nothing of another user's or another space's ledger", async () => {
    const { prisma, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace])
      for (const kind of ["stakeholder_ledger", "securities_ledger", "option_holders"] as const)
        expect((await f.as(scope, () => equityReport(prisma, scope, { kind }))).rows).toEqual([]);
  });

  it("records downloads in the history, newest first, for the caller only", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    await f.as(mine, () => equityReport(prisma, mine, { kind: "vesting" }));
    expect(await f.as(mine, () => equityReportHistory(prisma, mine))).toEqual([]);
    await f.as(mine, () =>
      equityReport(prisma, mine, {
        kind: "cap_table",
        asOf: "2026-01-31",
        groupBy: "stakeholder",
        fullyDiluted: false,
        record: true,
      }),
    );
    await f.as(mine, () => equityReport(prisma, mine, { kind: "vesting", record: true }));
    const history = await f.as(mine, () => equityReportHistory(prisma, mine));
    expect(history.map((row) => row.kind)).toEqual(["vesting", "cap_table"]);
    expect(history[1]).toMatchObject({
      asOf: "2026-01-31",
      groupBy: "stakeholder",
      fullyDiluted: false,
      includeConvertibles: true,
    });
    for (const scope of [sameSpace, otherSpace])
      expect(await f.as(scope, () => equityReportHistory(prisma, scope))).toEqual([]);
  });

  it("reports voting rights by class and by stakeholder from the class terms", async () => {
    const { prisma, mine, owner, sameSpace, otherSpace } = f;
    // Give the preferred class 2 votes per share in its current terms (invented).
    const preferred = await owner.equityShareClass.findFirstOrThrow({
      where: { ...mine, classType: "preferred" },
      include: { versions: true },
    });
    await owner.equityShareClassVersion.updateMany({
      where: { shareClassId: preferred.id },
      data: { votesPerShare: 2 },
    });
    const byClass = await f.as(mine, () => equityReport(prisma, mine, { kind: "voting_rights" }));
    const pref = byClass.rows.find((row) => row.shareClass === preferred.name)!;
    expect(pref).toMatchObject({ votesPerShare: "2.0000", shares: "2500000", votes: "5000000" });
    // Common 8,000,000 votes + preferred 5,000,000 = 13,000,000.
    expect(pref.percent).toBe("38.4615");
    const byHolder = await f.as(mine, () =>
      equityReport(prisma, mine, { kind: "voting_rights", groupBy: "stakeholder" }),
    );
    expect(byHolder.rows[0]).toMatchObject({
      stakeholder: "Ada Founder",
      votes: "5000000",
      percent: "38.4615",
    });
    expect(byHolder.rows.find((row) => row.stakeholder === "Example Ventures")?.votes).toBe(
      "5000000",
    );
    expect(byHolder.csv.split("\r\n")[0]).toBe("Stakeholder,Votes,Voting %");
    for (const scope of [sameSpace, otherSpace]) {
      const other = await f.as(scope, () =>
        equityReport(prisma, scope, { kind: "voting_rights", groupBy: "stakeholder" }),
      );
      expect(other.rows).toEqual([]);
    }
  });

  it("totals Raised to the overview's amount raised, settled convertibles included", async () => {
    const { prisma, mine, owner } = f;
    // Invented: a $50,000 SAFE converted into 50,000 preferred shares (the certificate's own
    // cash is the same money, so it must not count again) and a repaid $100,000 note.
    const preferred = await owner.equityShareClass.findFirstOrThrow({
      where: { ...mine, classType: "preferred" },
    });
    const fay = await owner.equityStakeholder.create({
      data: { ...mine, type: "individual", name: "Fay Angel" },
    });
    const eve = await owner.equityStakeholder.create({
      data: { ...mine, type: "individual", name: "Eve Lender" },
    });
    const safes = await owner.equityConvertibleBlock.create({
      data: { ...mine, name: "2025 SAFEs", kind: "safe" },
    });
    const notes = await owner.equityConvertibleBlock.create({
      data: { ...mine, name: "2024 Notes", kind: "note" },
    });
    const converted = await owner.equityCertificate.create({
      data: {
        ...mine,
        label: "PS-CONV-1",
        stakeholderId: fay.id,
        shareClassId: preferred.id,
        quantity: 50_000n,
        cashPaidCents: 5_000_000n,
        issueDate: new Date("2026-03-01T00:00:00.000Z"),
      },
    });
    await owner.equityConvertible.create({
      data: {
        ...mine,
        label: "SAFE-CONV-1",
        stakeholderId: fay.id,
        blockId: safes.id,
        kind: "safe",
        status: "converted",
        principalCents: 5_000_000n,
        issueDate: new Date("2025-02-01T00:00:00.000Z"),
        convertedToId: converted.id,
      },
    });
    await owner.equityConvertible.create({
      data: {
        ...mine,
        label: "NOTE-REPAID-1",
        stakeholderId: eve.id,
        blockId: notes.id,
        kind: "note",
        status: "repaid",
        principalCents: 10_000_000n,
        issueDate: new Date("2024-05-01T00:00:00.000Z"),
      },
    });

    const asOf = "2026-06-30";
    const overview = await f.as(mine, () => equityOverview(prisma, mine, { asOf }));
    const amountRaised = overview.totals.amountRaisedCents;
    const sum = (rows: Record<string, string | null>[]) =>
      rows.reduce((total, row) => total + BigInt(row.raised ?? "0"), 0n).toString();
    for (const fullyDiluted of [true, false])
      for (const groupBy of ["share_class", "stakeholder"] as const) {
        const label = `${groupBy} fullyDiluted=${fullyDiluted}`;
        const on = await f.as(mine, () =>
          equityReport(prisma, mine, { kind: "cap_table", asOf, groupBy, fullyDiluted }),
        );
        expect(on.rows.at(-1)?.raised, label).toBe(amountRaised);
        expect(sum(on.rows.slice(0, -1)), label).toBe(amountRaised);
        expect(on.rows.at(-1)?.shares, label).toBe(
          fullyDiluted ? overview.totals.fullyDilutedShares : overview.totals.outstandingShares,
        );
        const dollars = `${BigInt(amountRaised) / 100n}.${amountRaised.slice(-2)}`;
        expect(on.csv.trimEnd().split("\r\n").at(-1), label).toContain(dollars);
        const off = await f.as(mine, () =>
          equityReport(prisma, mine, {
            kind: "cap_table",
            asOf,
            groupBy,
            fullyDiluted,
            includeConvertibles: false,
          }),
        );
        expect(off.columns.find((c) => c.key === "raised")?.label, label).toBe(
          "Raised excluding convertibles",
        );
        expect(off.rows.at(-1)?.raised, label).toBe(sum(off.rows.slice(0, -1)));
        expect(BigInt(off.rows.at(-1)!.raised!), label).toBeLessThan(BigInt(amountRaised));
        if (groupBy === "share_class") {
          const byName = (name: string) => on.rows.find((row) => row.name === name);
          expect(byName("2025 SAFEs (converted)"), label).toMatchObject({
            shares: null,
            raised: "5000000",
          });
          expect(byName("2024 Notes (repaid)"), label).toMatchObject({
            shares: null,
            raised: "10000000",
          });
        } else {
          const byHolder = (name: string) => on.rows.find((row) => row.stakeholder === name);
          expect(byHolder("Fay Angel"), label).toMatchObject({
            shares: "50000",
            raised: "5000000",
          });
          expect(byHolder("Eve Lender"), label).toMatchObject({ shares: "0", raised: "10000000" });
        }
      }

    const cash = await f.as(mine, () => equityReport(prisma, mine, { kind: "cash_raised", asOf }));
    expect(cash.rows.at(-1)).toMatchObject({ security: "Total", raised: amountRaised });
    expect(cash.rows.map((row) => row.security)).not.toContain("PS-CONV-1");
    expect(cash.rows.map((row) => row.security)).toContain("NOTE-REPAID-1");
  });

  it("refuses an unknown report", async () => {
    const { prisma, mine } = f;
    await expect(f.as(mine, () => equityReport(prisma, mine, { kind: "taxes" }))).rejects.toThrow();
  });
});
