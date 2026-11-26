import type { EquityAccessLevel } from "@rakazo/contracts";
import { EQUITY_ACCESS_VIEW_KEYS, EquityAccessViewSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { setEquityAccessGrant } from "./access.js";
import { equityAccessView, equityHolderAccessLevel, equityHolderView } from "./access-view.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const person = (name: string, relationship: string) => ({
  type: "individual" as const,
  name,
  properties: [{ kind: "relationship" as const, effectiveDate: "2020-01-01", value: relationship }],
});

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const LEVELS: EquityAccessLevel[] = ["none", "restricted", "basic", "advanced", "full_detail"];

describeEquityPostgres("equity access view (PostgreSQL)", () => {
  let f: EquityFixture;
  const ids = { founder: "", investor: "", employee: "", nobody: "", foreign: "" };
  beforeAll(async () => {
    f = await equityFixture("access-view");
    const { prisma, mine, otherSpace, owner } = f;
    const make = (name: string, relationship: string) =>
      f.as(mine, () => createEquityStakeholder(prisma, mine, person(name, relationship)));
    ids.founder = (await make("Ada Founder", "founder")).id;
    ids.investor = (await make("Ben Investor", "investor")).id;
    ids.employee = (await make("Cy Employee", "employee")).id;
    ids.nobody = (await make("Di Nobody", "other")).id;
    ids.foreign = (
      await f.as(otherSpace, () =>
        createEquityStakeholder(prisma, otherSpace, person("Ed Elsewhere", "founder")),
      )
    ).id;
    const common = await owner.equityShareClass.create({
      data: { ...mine, name: "Common", prefix: "CS", classType: "common" },
    });
    const preferred = await owner.equityShareClass.create({
      data: { ...mine, name: "Series A Preferred", prefix: "PA", classType: "preferred" },
    });
    await owner.equityShareClassVersion.createMany({
      data: [
        {
          ...mine,
          shareClassId: common.id,
          documentDate: day("2020-01-01"),
          authorizedShares: 10_000_000n,
        },
        {
          ...mine,
          shareClassId: preferred.id,
          documentDate: day("2021-01-01"),
          authorizedShares: 2_000_000n,
          originalIssuePrice: "1.25",
          seniority: 2,
        },
      ],
    });
    const plan = await owner.equityPlan.create({
      data: { ...mine, name: "2020 Plan", shareClassId: common.id, reservedShares: 1_000_000n },
    });
    await owner.equityCertificate.createMany({
      data: [
        {
          ...mine,
          label: "CS-1",
          stakeholderId: ids.founder,
          shareClassId: common.id,
          quantity: 5_000_000n,
          issueDate: day("2020-01-02"),
        },
        {
          ...mine,
          label: "PA-1",
          stakeholderId: ids.investor,
          shareClassId: preferred.id,
          quantity: 1_000_000n,
          issueDate: day("2021-02-01"),
        },
        {
          ...mine,
          label: "CS-2",
          stakeholderId: ids.nobody,
          shareClassId: common.id,
          quantity: 10n,
          issueDate: day("2020-03-01"),
          status: "canceled",
        },
      ],
    });
    await owner.equityOptionGrant.create({
      data: {
        ...mine,
        label: "ES-1",
        stakeholderId: ids.employee,
        planId: plan.id,
        shareClassId: common.id,
        optionType: "iso",
        quantity: 40_000n,
        exercisePrice: "0.10",
        grantDate: day("2022-01-01"),
      },
    });
    await owner.equityFundingRound.create({
      data: {
        ...mine,
        name: "Series A",
        startDate: day("2021-01-15"),
        closingDate: day("2021-02-01"),
      },
    });
  });
  afterAll(async () => {
    await f?.close();
  });

  it("each level returns exactly its sections", async () => {
    const { prisma, mine } = f;
    for (const level of LEVELS) {
      const view = await f.as(mine, () =>
        equityAccessView(prisma, mine, { stakeholderId: ids.employee, level }),
      );
      EquityAccessViewSchema.parse(view);
      expect(Object.keys(view).sort()).toEqual(["level", ...EQUITY_ACCESS_VIEW_KEYS[level]].sort());
      expect(view.level).toBe(level);
    }
  });

  it("restricted shows only the holder's own holdings", async () => {
    const { prisma, mine } = f;
    const view = await f.as(mine, () =>
      equityAccessView(prisma, mine, { stakeholderId: ids.employee, level: "restricted" }),
    );
    expect(view.personal?.holdings).toEqual([
      expect.objectContaining({ kind: "option", label: "ES-1", quantity: "40000" }),
    ]);
    expect(JSON.stringify(view)).not.toContain("Ada Founder");
    expect(JSON.stringify(view)).not.toContain("CS-1");
  });

  it("advanced lists preferred holders only; full detail lists every holder", async () => {
    const { prisma, mine } = f;
    const advanced = await f.as(mine, () =>
      equityAccessView(prisma, mine, { stakeholderId: ids.employee, level: "advanced" }),
    );
    expect(advanced.holders?.map((row) => row.name)).toEqual(["Ben Investor"]);
    const full = await f.as(mine, () =>
      equityAccessView(prisma, mine, { stakeholderId: ids.employee, level: "full_detail" }),
    );
    expect(full.holders?.map((row) => row.name)).toEqual([
      "Ada Founder",
      "Ben Investor",
      "Cy Employee",
    ]);
    expect(full.summary?.outstandingShares).toBe("6000000");
    expect(full.shareClasses?.map((row) => row.prefix).sort()).toEqual(["CS", "PA"]);
    expect(full.fundraising?.[0]).toMatchObject({ name: "Series A", closingDate: "2021-02-01" });
  });

  it("a holder's own view follows group, override, and losing all holdings", async () => {
    const { prisma, mine } = f;
    expect(await f.as(mine, () => equityHolderAccessLevel(prisma, mine, ids.founder))).toBe(
      "full_detail",
    );
    expect(await f.as(mine, () => equityHolderAccessLevel(prisma, mine, ids.investor))).toBe(
      "advanced",
    );
    expect(await f.as(mine, () => equityHolderAccessLevel(prisma, mine, ids.employee))).toBe(
      "basic",
    );
    // Only a canceled certificate: no outstanding holdings, so no access.
    expect(await f.as(mine, () => equityHolderAccessLevel(prisma, mine, ids.nobody))).toBe("none");
    expect(await f.as(mine, () => equityHolderView(prisma, mine, ids.nobody))).toEqual({
      level: "none",
    });
    await f.as(mine, () =>
      setEquityAccessGrant(prisma, mine, { stakeholderId: ids.employee, level: "restricted" }),
    );
    const own = await f.as(mine, () => equityHolderView(prisma, mine, ids.employee));
    expect(Object.keys(own).sort()).toEqual(["fairMarketValue", "level", "personal"]);
    // An override never lifts someone without holdings.
    await f.as(mine, () =>
      setEquityAccessGrant(prisma, mine, { stakeholderId: ids.nobody, level: "full_detail" }),
    );
    expect(await f.as(mine, () => equityHolderAccessLevel(prisma, mine, ids.nobody))).toBe("none");
  });

  it("another user or space cannot read a holder or see the ledger", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace]) {
      await expect(
        f.as(scope, () => equityAccessView(prisma, scope, { stakeholderId: ids.founder })),
      ).rejects.toThrow(/not found/i);
      await expect(
        f.as(scope, () => equityHolderView(prisma, scope, ids.investor)),
      ).rejects.toThrow(/not found/i);
      await expect(
        f.as(scope, () => equityHolderAccessLevel(prisma, scope, ids.employee)),
      ).rejects.toThrow(/not found/i);
    }
    await expect(
      f.as(mine, () => equityAccessView(prisma, mine, { stakeholderId: ids.foreign })),
    ).rejects.toThrow(/not found/i);
    // The other space's founder holds nothing there, and their view carries none of this ledger.
    const theirs = await f.as(otherSpace, () =>
      equityAccessView(prisma, otherSpace, { stakeholderId: ids.foreign, level: "full_detail" }),
    );
    expect(theirs.holders).toEqual([]);
    expect(JSON.stringify(theirs)).not.toMatch(/Ada Founder|Series A|CS-1/);
  });
});
