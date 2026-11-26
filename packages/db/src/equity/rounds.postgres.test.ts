import { EquityDraftSetSchema, EquityFundingRoundSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError, ensureLedger } from "./ledger.js";
import {
  createEquityDraftSet,
  createEquityFundingRound,
  getEquityDraftSet,
  getEquityFundingRound,
  listEquityDraftSets,
  listEquityFundingRounds,
  updateEquityDraftSet,
  updateEquityFundingRound,
} from "./rounds.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity funding rounds and draft sets (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("rounds");
  });
  afterAll(async () => {
    await f?.close();
  });

  async function seed() {
    const { prisma, mine } = f;
    const suffix = Math.random().toString(36).slice(2, 8);
    return f.as(mine, async () => {
      await ensureLedger(prisma, mine);
      const holder = await prisma.equityStakeholder.create({
        data: { ...mine, type: "individual", name: `Ada Example ${suffix}` },
      });
      const common = await prisma.equityShareClass.create({
        data: { ...mine, name: `Common ${suffix}`, prefix: `CS-${suffix}`, classType: "common" },
      });
      const preferred = await prisma.equityShareClass.create({
        data: {
          ...mine,
          name: `Series Seed ${suffix}`,
          prefix: `PS-${suffix}`,
          classType: "preferred",
        },
      });
      return { holder, common, preferred };
    });
  }

  it("creates, derives, updates and lists rounds", async () => {
    const { prisma, mine } = f;
    const { holder, common, preferred } = await seed();
    const seedRound = await f.as(mine, () =>
      createEquityFundingRound(prisma, mine, {
        name: "Seed",
        startDate: "2021-01-01",
        endDate: "2021-06-30",
        closingDate: "2021-07-15",
        originalIssuePrice: "1.25",
        preMoneyValuationCents: "400000000",
      }),
    );
    expect(seedRound.cashRaisedCents).toBe("0");
    expect(seedRound.sharesIssued).toBe("0");
    expect(EquityFundingRoundSchema.parse(seedRound)).toBeTruthy();

    await f.as(mine, async () => {
      await prisma.equityCertificate.create({
        data: {
          ...mine,
          label: `CS-1-${seedRound.id}`,
          stakeholderId: holder.id,
          shareClassId: common.id,
          quantity: 1_000_000n,
          cashPaidCents: 250_000n,
          debtCanceledCents: 50_000n,
          ipTransferredCents: 25_000n,
          otherConsiderationCents: 5_000n,
          issueDate: new Date("2021-02-01T00:00:00.000Z"),
          roundId: seedRound.id,
        },
      });
      await prisma.equityCertificate.create({
        data: {
          ...mine,
          label: `PS-1-${seedRound.id}`,
          stakeholderId: holder.id,
          shareClassId: preferred.id,
          quantity: 500_000n,
          cashPaidCents: 500_000n,
          issueDate: new Date("2021-03-01T00:00:00.000Z"),
          roundId: seedRound.id,
        },
      });
      await prisma.equityCertificate.create({
        data: {
          ...mine,
          label: `CS-2-${seedRound.id}`,
          stakeholderId: holder.id,
          shareClassId: common.id,
          quantity: 900_000n,
          cashPaidCents: 900_000n,
          issueDate: new Date("2021-03-02T00:00:00.000Z"),
          roundId: seedRound.id,
          status: "canceled",
        },
      });
      await prisma.equityConvertible.create({
        data: {
          ...mine,
          label: `SAFE-1-${seedRound.id}`,
          stakeholderId: holder.id,
          kind: "safe",
          principalCents: 100_000n,
          issueDate: new Date("2021-02-15T00:00:00.000Z"),
          roundId: seedRound.id,
        },
      });
    });

    const derived = await f.as(mine, () => getEquityFundingRound(prisma, mine, seedRound.id));
    // 250000 + 50000 + 25000 + 5000 + 500000 (certs, canceled excluded) + 100000 (SAFE).
    expect(derived.cashRaisedCents).toBe("930000");
    expect(derived.sharesIssued).toBe("1500000");
    expect(derived.securityCount).toBe(3);
    expect(derived.shareClassCount).toBe(2);

    const overridden = await f.as(mine, () =>
      updateEquityFundingRound(prisma, mine, {
        id: seedRound.id,
        name: "Seed II",
        overrides: { cashRaisedCents: "1", sharesIssued: "2" },
      }),
    );
    expect(overridden.name).toBe("Seed II");
    expect(overridden.cashRaisedCents).toBe("1");
    expect(overridden.sharesIssued).toBe("2");
    expect(overridden.securityCount).toBe(3);

    await f.as(mine, () =>
      createEquityFundingRound(prisma, mine, { name: "Series A", startDate: "2022-01-01" }),
    );
    const page = await f.as(mine, () =>
      listEquityFundingRounds(prisma, mine, {
        sort: { field: "name", dir: "asc" },
        search: "series",
      }),
    );
    expect(page.total).toBe(1);
    expect(page.items[0]?.name).toBe("Series A");
    const byDate = await f.as(mine, () =>
      listEquityFundingRounds(prisma, mine, {
        sort: { field: "closingDate", dir: "desc" },
        pageSize: 1,
      }),
    );
    expect(byDate.total).toBe(2);
    expect(byDate.items).toHaveLength(1);
    const paged = await f.as(mine, () =>
      listEquityFundingRounds(prisma, mine, {
        sort: { field: "startDate", dir: "asc" },
        page: 2,
        pageSize: 1,
      }),
    );
    expect(paged.items[0]?.name).toBe("Series A");
  });

  it("refuses duplicate names, bad dates and unknown ids", async () => {
    const { prisma, mine } = f;
    const { common } = await seed();
    await f.as(mine, () =>
      createEquityFundingRound(prisma, mine, { name: "Bridge", startDate: "2023-01-01" }),
    );
    await expect(
      f.as(mine, () =>
        createEquityFundingRound(prisma, mine, { name: "Bridge", startDate: "2023-02-01" }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    await expect(
      f.as(mine, () =>
        createEquityFundingRound(prisma, mine, {
          name: "Late",
          startDate: "2023-05-01",
          endDate: "2023-04-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        createEquityFundingRound(prisma, mine, {
          name: "Closing",
          startDate: "2023-05-01",
          closingDate: "2023-04-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () => getEquityFundingRound(prisma, mine, "missing-round")),
    ).rejects.toBeInstanceOf(IsolationError);
    expect(common.id).toBeTruthy();
  });

  it("draft sets: create, rename, replace items, discard, list and scope", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const { holder } = await seed();
    const set = await f.as(mine, () =>
      createEquityDraftSet(prisma, mine, {
        name: "Board batch",
        securityKind: "certificate",
        items: [
          {
            stakeholderId: holder.id,
            shareClassId: "class-1",
            quantity: "1000",
            issueDate: "2024-01-01",
          },
        ],
      }),
    );
    expect(set.status).toBe("draft");
    expect(set).toMatchObject({ revision: 1, issuedIds: [] });
    expect(set.items).toHaveLength(1);
    expect(set.issuedAt).toBeNull();
    expect(EquityDraftSetSchema.parse(set)).toBeTruthy();

    const renamed = await f.as(mine, () =>
      updateEquityDraftSet(prisma, mine, {
        id: set.id,
        expectedRevision: set.revision,
        name: "Board batch 2",
        items: [],
      }),
    );
    expect(renamed.name).toBe("Board batch 2");
    expect(renamed.revision).toBe(2);
    expect(renamed.items).toEqual([]);

    await expect(
      f.as(mine, () =>
        updateEquityDraftSet(prisma, mine, {
          id: set.id,
          expectedRevision: set.revision,
          name: "Stale edit",
        }),
      ),
    ).rejects.toMatchObject({ name: "EquityConflictError" });

    const discarded = await f.as(mine, () =>
      updateEquityDraftSet(prisma, mine, {
        id: set.id,
        expectedRevision: renamed.revision,
        status: "discarded",
      }),
    );
    expect(discarded.status).toBe("discarded");
    expect(discarded.revision).toBe(3);
    await expect(
      f.as(mine, () =>
        updateEquityDraftSet(prisma, mine, {
          id: set.id,
          expectedRevision: discarded.revision,
          name: "Again",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);

    await expect(
      f.as(mine, () =>
        createEquityDraftSet(prisma, mine, {
          name: "Broken",
          securityKind: "certificate",
          items: [{ stakeholderId: "x" }],
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    await f.as(mine, () =>
      createEquityDraftSet(prisma, mine, { name: "Safe batch", securityKind: "convertible" }),
    );
    const page = await f.as(mine, () =>
      listEquityDraftSets(prisma, mine, {
        securityKind: "convertible",
        status: ["draft"],
        sort: { field: "name", dir: "asc" },
        search: "safe",
      }),
    );
    expect(page.total).toBe(1);
    expect(page.items[0]?.name).toBe("Safe batch");
    const all = await f.as(mine, () =>
      listEquityDraftSets(prisma, mine, { sort: { field: "updatedAt", dir: "desc" }, pageSize: 1 }),
    );
    expect(all.total).toBe(2);
    expect(all.items).toHaveLength(1);

    // Another user in the space and another space cannot see or touch the rows.
    expect(await f.as(sameSpace, () => listEquityDraftSets(prisma, sameSpace, {}))).toMatchObject({
      total: 0,
    });
    expect(
      await f.as(otherSpace, () => listEquityFundingRounds(prisma, otherSpace, {})),
    ).toMatchObject({ total: 0 });
    await expect(
      f.as(sameSpace, () => getEquityDraftSet(prisma, sameSpace, set.id)),
    ).rejects.toBeInstanceOf(IsolationError);
    await expect(
      f.as(otherSpace, () =>
        updateEquityDraftSet(prisma, otherSpace, {
          id: set.id,
          expectedRevision: set.revision,
          name: "x",
        }),
      ),
    ).rejects.toBeInstanceOf(IsolationError);
  });
});
