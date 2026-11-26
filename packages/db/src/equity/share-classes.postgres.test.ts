import {
  EquityPlanPageSchema,
  EquityPlanSchema,
  EquityShareClassPageSchema,
  EquityShareClassSchema,
} from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError, toDate } from "./ledger.js";
import {
  createEquityPlan,
  createEquityShareClass,
  getEquityPlan,
  getEquityShareClass,
  listEquityPlans,
  listEquityShareClasses,
  updateEquityPlan,
  updateEquityShareClass,
} from "./share-classes.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity share classes and plans (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("share-classes");
  });
  afterAll(async () => {
    await f?.close();
  });

  const createClass = (mine: EquityFixture["mine"], over: Record<string, unknown> = {}) =>
    createEquityShareClass(f.prisma, mine, {
      name: "Common Stock",
      prefix: "CS",
      classType: "common",
      terms: { documentDate: "2020-01-01", authorizedShares: "10000000" },
      ...over,
    });

  it("creates a class with its first version and normalizes terms", async () => {
    const { prisma, mine } = f;
    const common = await f.as(mine, () => createClass(mine));
    expect(EquityShareClassSchema.parse(common)).toEqual(common);
    expect(common.current.authorizedShares).toBe("10000000");
    expect(common.current.votesPerShare).toBe("1");
    expect(common.current.certificated).toBe(true);
    expect(common.current.seniority).toBe(1);
    expect(common.current.parValue).toBeNull();
    expect(common.versions).toHaveLength(1);
    expect(common.prefix).toBe("CS");

    const preferred = await f.as(mine, () =>
      createClass(mine, {
        name: "Series A Preferred",
        prefix: "PS",
        classType: "preferred",
        terms: {
          documentDate: "2021-06-01",
          authorizedShares: "2000000",
          seniority: 2,
          originalIssuePrice: "1.25",
        },
      }),
    );
    expect(preferred.current.seniority).toBe(2);
    expect(preferred.current.originalIssuePrice).toBe("1.25");

    await expect(f.as(mine, () => createClass(mine))).rejects.toBeInstanceOf(EquityConflictError);
    await expect(
      f.as(mine, () => createClass(mine, { name: "Other", prefix: "PS" })),
    ).rejects.toBeInstanceOf(EquityConflictError);

    // A second document date adds a version; the newer one is current.
    const amended = await f.as(mine, () =>
      updateEquityShareClass(prisma, mine, {
        id: common.id,
        terms: { documentDate: "2022-03-01", authorizedShares: "12000000", seniority: 1 },
      }),
    );
    expect(amended.current.documentDate).toBe("2022-03-01");
    expect(amended.current.authorizedShares).toBe("12000000");
    expect(amended.current.votesPerShare).toBe("1");
    expect(amended.versions.map((row) => row.documentDate)).toEqual(["2022-03-01", "2020-01-01"]);
    // Changing an existing date only writes the given fields.
    const adjusted = await f.as(mine, () =>
      updateEquityShareClass(prisma, mine, {
        id: common.id,
        name: "Common Shares",
        terms: { documentDate: "2020-01-01", authorizedShares: "9000000" },
      }),
    );
    expect(adjusted.name).toBe("Common Shares");
    expect(adjusted.versions).toHaveLength(2);
    expect(adjusted.versions[1]!.authorizedShares).toBe("9000000");
    expect(adjusted.versions[1]!.seniority).toBe(1);

    // asOfDocumentDate picks the terms in force then, and leaves classes without any out.
    const asOf = await f.as(mine, () =>
      listEquityShareClasses(prisma, mine, { asOfDocumentDate: "2021-01-01" }),
    );
    expect(asOf.items.map((row) => row.name)).toEqual(["Common Shares"]);
    expect(asOf.items[0]!.current.documentDate).toBe("2020-01-01");
    expect(EquityShareClassPageSchema.parse(asOf)).toEqual(asOf);

    // Authorized shares may not fall below the class's issued shares.
    const stakeholder = await f.owner.equityStakeholder.create({
      data: { ...mine, type: "individual", name: "Ada Example" },
    });
    await f.owner.equityCertificate.create({
      data: {
        ...mine,
        label: "CS-1",
        stakeholderId: stakeholder.id,
        shareClassId: common.id,
        quantity: 8_000_000n,
        issueDate: toDate("2020-02-01"),
      },
    });
    await expect(
      f.as(mine, () =>
        updateEquityShareClass(prisma, mine, {
          id: common.id,
          terms: { documentDate: "2023-01-01", authorizedShares: "500" },
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    // Sorts by seniority and class type, filters and searches.
    const bySeniority = await f.as(mine, () =>
      listEquityShareClasses(prisma, mine, {
        sort: { field: "seniority", dir: "desc" },
        pageSize: 1,
      }),
    );
    expect(bySeniority.items[0]!.id).toBe(preferred.id);
    expect(bySeniority.total).toBe(2);
    const paged = await f.as(mine, () =>
      listEquityShareClasses(prisma, mine, {
        page: 2,
        pageSize: 1,
        sort: { field: "name", dir: "asc" },
      }),
    );
    expect(paged.items).toHaveLength(1);
    const preferredOnly = await f.as(mine, () =>
      listEquityShareClasses(prisma, mine, { classType: "preferred" }),
    );
    expect(preferredOnly.items.map((row) => row.prefix)).toEqual(["PS"]);
    const searched = await f.as(mine, () =>
      listEquityShareClasses(prisma, mine, { search: "SERIES" }),
    );
    expect(searched.items.map((row) => row.id)).toEqual([preferred.id]);
    const byCreated = await f.as(mine, () =>
      listEquityShareClasses(prisma, mine, { sort: { field: "createdAt", dir: "desc" } }),
    );
    expect(byCreated.items).toHaveLength(2);

    expect(await f.as(mine, () => getEquityShareClass(prisma, mine, common.id))).toMatchObject({
      id: common.id,
    });
    await expect(
      f.as(mine, () => updateEquityShareClass(prisma, mine, { id: "nope", name: "X" })),
    ).rejects.toBeInstanceOf(IsolationError);

    // Scoping: other users in the space and the same user in another space see no rows.
    for (const other of [f.sameSpace, f.otherSpace]) {
      const page = await f.as(other, () => listEquityShareClasses(prisma, other, {}));
      expect(page.total).toBe(0);
      await expect(
        f.as(other, () => getEquityShareClass(prisma, other, common.id)),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(other, () =>
          updateEquityShareClass(prisma, other, {
            id: common.id,
            terms: { documentDate: "2024-01-01", authorizedShares: "1" },
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(f.as(other, () => createClass(other))).resolves.toMatchObject({ prefix: "CS" });
    }
  });

  it("plans derive outstanding, issued and available shares and record pool changes", async () => {
    const { prisma, mine } = f;
    const common = await f.as(mine, () => createClass(mine, { name: "Plan Common", prefix: "PC" }));
    const stakeholder = await f.owner.equityStakeholder.create({
      data: { ...mine, type: "individual", name: "Ben Sample" },
    });
    const plan = await f.as(mine, () =>
      createEquityPlan(prisma, mine, {
        name: "2024 Stock Plan",
        shareClassId: common.id,
        reservedShares: "1000000",
        boardApprovedOn: "2024-01-15",
      }),
    );
    expect(EquityPlanSchema.parse(plan)).toEqual(plan);
    expect(plan.status).toBe("active");
    expect(plan.outstandingShares).toBe("0");
    expect(plan.issuedShares).toBe("0");
    expect(plan.availableShares).toBe("1000000");

    const change = await f.owner.equityTransaction.findFirst({
      where: { ...mine, planId: plan.id, kind: "pool_change" },
    });
    expect(change?.quantity).toBe(1_000_000n);

    const grant = await f.owner.equityOptionGrant.create({
      data: {
        ...mine,
        label: "PC-1",
        stakeholderId: stakeholder.id,
        planId: plan.id,
        shareClassId: common.id,
        optionType: "iso",
        quantity: 100_000n,
        exercisedQuantity: 20_000n,
        exercisePrice: "0.1",
        grantDate: toDate("2024-02-01"),
      },
    });
    await f.owner.equityCertificate.create({
      data: {
        ...mine,
        label: "PC-2",
        stakeholderId: stakeholder.id,
        shareClassId: common.id,
        planId: plan.id,
        quantity: 5_000n,
        issueDate: toDate("2024-03-01"),
      },
    });
    const loaded = await f.as(mine, () => getEquityPlan(prisma, mine, plan.id));
    expect(loaded.outstandingShares).toBe("80000");
    expect(loaded.issuedShares).toBe("25000");
    expect(loaded.availableShares).toBe("895000");

    await expect(
      f.as(mine, () => updateEquityPlan(prisma, mine, { id: plan.id, reservedShares: "90000" })),
    ).rejects.toBeInstanceOf(EquityInputError);
    const raised = await f.as(mine, () =>
      updateEquityPlan(prisma, mine, {
        id: plan.id,
        reservedShares: "1200000",
        status: "inactive",
      }),
    );
    expect(raised.reservedShares).toBe("1200000");
    expect(raised.status).toBe("inactive");
    expect(raised.availableShares).toBe("1095000");
    const pool = await f.owner.equityTransaction.findMany({
      where: { ...mine, planId: plan.id, kind: "pool_change" },
      orderBy: { createdAt: "asc" },
    });
    expect(pool).toHaveLength(2);
    expect(pool[1]!.quantity).toBe(200_000n);

    // Reserved shares may not fall below outstanding + issued.
    await expect(
      f.as(mine, () => updateEquityPlan(prisma, mine, { id: plan.id, reservedShares: "100000" })),
    ).rejects.toBeInstanceOf(EquityInputError);

    const second = await f.as(mine, () =>
      createEquityPlan(prisma, mine, {
        name: "2020 Plan",
        shareClassId: common.id,
        reservedShares: "500",
      }),
    );
    await expect(
      f.as(mine, () =>
        createEquityPlan(prisma, mine, {
          name: "2024 Stock Plan",
          shareClassId: common.id,
          reservedShares: "1",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    await expect(
      f.as(mine, () =>
        createEquityPlan(prisma, mine, {
          name: "Bad Plan",
          shareClassId: "missing",
          reservedShares: "1",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const sorted = await f.as(mine, () =>
      listEquityPlans(prisma, mine, { sort: { field: "reservedShares", dir: "desc" } }),
    );
    expect(EquityPlanPageSchema.parse(sorted)).toEqual(sorted);
    expect(sorted.items.map((row) => row.id)).toEqual([plan.id, second.id]);
    const inactive = await f.as(mine, () => listEquityPlans(prisma, mine, { status: "inactive" }));
    expect(inactive.items.map((row) => row.id)).toEqual([plan.id]);
    const search = await f.as(mine, () => listEquityPlans(prisma, mine, { search: "2020" }));
    expect(search.items.map((row) => row.id)).toEqual([second.id]);
    const page = await f.as(mine, () =>
      listEquityPlans(prisma, mine, { pageSize: 2, sort: { field: "name", dir: "asc" } }),
    );
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(2);
    const createdSort = await f.as(mine, () =>
      listEquityPlans(prisma, mine, { sort: { field: "createdAt", dir: "desc" } }),
    );
    expect(createdSort.items).toHaveLength(2);
    const statusSort = await f.as(mine, () =>
      listEquityPlans(prisma, mine, { sort: { field: "status", dir: "asc" } }),
    );
    expect(statusSort.items).toHaveLength(2);

    for (const other of [f.sameSpace, f.otherSpace]) {
      expect(await f.as(other, () => listEquityPlans(prisma, other, {}))).toMatchObject({
        total: 0,
      });
      await expect(f.as(other, () => getEquityPlan(prisma, other, plan.id))).rejects.toBeInstanceOf(
        IsolationError,
      );
      await expect(
        f.as(other, () => updateEquityPlan(prisma, other, { id: plan.id, reservedShares: "1" })),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(other, () =>
          createEquityPlan(prisma, other, {
            name: "Theirs",
            shareClassId: common.id,
            reservedShares: "1",
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    }
    await expect(
      f.as(mine, () => updateEquityPlan(prisma, mine, { id: grant.id, reservedShares: "1" })),
    ).rejects.toBeInstanceOf(IsolationError);
  });
});
