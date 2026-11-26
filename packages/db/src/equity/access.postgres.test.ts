import {
  EquityAccessGrantPageSchema,
  EquityAccessGrantSchema,
  EquityAccessGroupSchema,
  EquityHealthFindingPageSchema,
  EquityHealthFindingSchema,
  EquitySavedViewPageSchema,
  EquitySavedViewSchema,
} from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createEquityHealthFinding,
  createEquitySavedView,
  effectiveEquityAccessLevel,
  equityAccessGroupOf,
  getEquityHealthFinding,
  getEquitySavedView,
  listEquityAccessGrants,
  listEquityAccessGroups,
  listEquityHealthFindings,
  listEquitySavedViews,
  setEquityAccessGrant,
  setEquityAccessGroup,
  updateEquityHealthFinding,
  updateEquitySavedView,
} from "./access.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const person = (
  name: string,
  relationship: string,
  contactEmail = `${name.split(" ")[0]!.toLowerCase()}@example.test`,
) => ({
  type: "individual" as const,
  name,
  contactEmail,
  properties: [{ kind: "relationship" as const, effectiveDate: "2020-01-01", value: relationship }],
});

describeEquityPostgres("equity access stores (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("access");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("saved views: CRUD, filters, sorts, search, pages and conflicts", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const one = await f.as(mine, () =>
      createEquitySavedView(prisma, mine, {
        page: "stakeholders",
        name: "Employees",
        params: "relationship=employee",
      }),
    );
    const two = await f.as(mine, () =>
      createEquitySavedView(prisma, mine, {
        page: "securities",
        name: "Certificates",
        params: "sort=label",
      }),
    );
    expect(EquitySavedViewSchema.parse(one)).toMatchObject({ name: "Employees" });

    const byPage = await f.as(mine, () =>
      listEquitySavedViews(prisma, mine, { pageSize: 1, page: "stakeholders" as never }),
    );
    expect(EquitySavedViewPageSchema.parse(byPage).total).toBe(1);
    const bySearch = await f.as(mine, () =>
      listEquitySavedViews(prisma, mine, { pageSize: 25, search: "cert" }),
    );
    expect(bySearch.items.map((row) => row.id)).toEqual([two.id]);
    const sorted = await f.as(mine, () =>
      listEquitySavedViews(prisma, mine, {
        pageSize: 25,
        sort: { field: "updatedAt", dir: "desc" },
      }),
    );
    expect(sorted.total).toBe(2);

    const updated = await f.as(mine, () =>
      updateEquitySavedView(prisma, mine, {
        id: one.id,
        name: "Team",
        params: "relationship=founder",
      }),
    );
    expect(updated.name).toBe("Team");
    await expect(
      f.as(mine, () =>
        createEquitySavedView(prisma, mine, {
          page: "stakeholders",
          name: "Team",
          params: "x=1",
        }),
      ),
    ).rejects.toMatchObject({ name: "EquityConflictError" });

    await expect(
      f.as(sameSpace, () => getEquitySavedView(prisma, sameSpace, one.id)),
    ).rejects.toThrow();
    await expect(
      f.as(otherSpace, () => listEquitySavedViews(prisma, otherSpace, { pageSize: 25 })),
    ).resolves.toMatchObject({ total: 0 });
    await expect(
      f.as(sameSpace, () => updateEquitySavedView(prisma, sameSpace, { id: one.id, name: "Nope" })),
    ).rejects.toThrow();
  });

  it("access groups: defaults, counts, set and effective level", async () => {
    const { prisma, mine, otherSpace } = f;
    const ada = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, person("Ada Founder", "founder")),
    );
    await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, person("Ben Investor", "investor")),
    );
    await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, person("Cy Employee", "employee")),
    );
    await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, person("Di Former", "ex_employee")),
    );
    await f.as(mine, () => createEquityStakeholder(prisma, mine, person("Ed Other", "other")));

    const defaults = await f.as(mine, () => listEquityAccessGroups(prisma, mine));
    expect(defaults.map((row) => row.key)).toEqual([
      "founders",
      "investors",
      "employees",
      "former_employees",
      "other",
    ]);
    for (const group of defaults) EquityAccessGroupSchema.parse(group);
    expect(defaults.map((row) => row.level)).toEqual([
      "full_detail",
      "advanced",
      "basic",
      "basic",
      "basic",
    ]);
    expect(defaults.map((row) => row.memberCount)).toEqual([1, 1, 1, 1, 1]);
    expect(defaults.every((row) => row.updatedAt === null)).toBe(true);

    const set = await f.as(mine, () =>
      setEquityAccessGroup(prisma, mine, { key: "employees", level: "basic" }),
    );
    expect(set).toMatchObject({ key: "employees", level: "basic", memberCount: 1 });
    expect(set.updatedAt).not.toBeNull();
    const again = await f.as(mine, () =>
      setEquityAccessGroup(prisma, mine, { key: "employees", level: "advanced" }),
    );
    expect(again.level).toBe("advanced");
    expect(again.memberCount).toBe(1);
    expect(await f.as(mine, () => effectiveEquityAccessLevel(prisma, mine, ada.id))).toBe(
      "full_detail",
    );
    await expect(
      f.as(otherSpace, () => listEquityAccessGroups(prisma, otherSpace)),
    ).resolves.toHaveLength(5);
    await expect(
      f.as(otherSpace, () => effectiveEquityAccessLevel(prisma, otherSpace, ada.id)),
    ).rejects.toThrow();
    expect(equityAccessGroupOf("board_member")).toBe("investors");
    expect(equityAccessGroupOf("ex_employee")).toBe("former_employees");
    expect(equityAccessGroupOf(null)).toBe("other");
    expect(equityAccessGroupOf("consultant")).toBe("other");
  });

  it("access grants: set, clear, requested filter, search and scoping", async () => {
    const { prisma, mine, sameSpace } = f;
    const target = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, person("Fay Holder", "employee")),
    );
    const grant = await f.as(mine, () =>
      setEquityAccessGrant(prisma, mine, { stakeholderId: target.id, level: "basic" }),
    );
    expect(EquityAccessGrantSchema.parse(grant)).toMatchObject({
      stakeholderName: "Fay Holder",
      level: "basic",
      requestedLevel: null,
    });
    expect(await f.as(mine, () => effectiveEquityAccessLevel(prisma, mine, target.id))).toBe(
      "basic",
    );
    const cleared = await f.as(mine, () =>
      setEquityAccessGrant(prisma, mine, { stakeholderId: target.id, level: null }),
    );
    expect(cleared.level).toBeNull();
    expect(await f.as(mine, () => effectiveEquityAccessLevel(prisma, mine, target.id))).toBe(
      "advanced",
    );

    await f.owner.equityAccessGrant.update({
      where: { id: grant.id },
      data: { requestedLevel: "advanced", requestedAt: new Date() },
    });
    const requested = await f.as(mine, () =>
      listEquityAccessGrants(prisma, mine, { page: 1, pageSize: 25, requested: true }),
    );
    EquityAccessGrantPageSchema.parse(requested);
    expect(requested.items.map((row) => row.id)).toEqual([grant.id]);
    const sorted = await f.as(mine, () =>
      listEquityAccessGrants(prisma, mine, {
        page: 1,
        pageSize: 25,
        search: "fay",
        sort: { field: "updatedAt", dir: "desc" },
      }),
    );
    expect(sorted.total).toBe(1);
    await expect(
      f.as(sameSpace, () =>
        setEquityAccessGrant(prisma, sameSpace, { stakeholderId: target.id, level: "basic" }),
      ),
    ).rejects.toThrow();
    await expect(
      f.as(mine, () =>
        setEquityAccessGrant(prisma, mine, { stakeholderId: "missing-id", level: "basic" }),
      ),
    ).rejects.toMatchObject({ name: "EquityInputError" });
  });

  it("health findings: upsert, dismissal, resolution, filters and scoping", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const input = {
      check: "duplicated_stakeholder",
      tag: "stakeholder" as const,
      severity: "required" as const,
      fingerprint: "fp-1",
      rows: [{ name: "Ada Example" }],
    };
    const finding = await f.as(mine, () => createEquityHealthFinding(prisma, mine, input));
    expect(EquityHealthFindingSchema.parse(finding)).toMatchObject({ status: "open" });
    const updated = await f.as(mine, () =>
      updateEquityHealthFinding(prisma, mine, { id: finding.id, status: "dismissed" }),
    );
    expect(updated.status).toBe("dismissed");
    expect(updated.dismissedAt).not.toBeNull();
    const rerun = await f.as(mine, () =>
      createEquityHealthFinding(prisma, mine, { ...input, rows: [{ name: "Ben Example" }] }),
    );
    expect(rerun.id).toBe(finding.id);
    expect(rerun.status).toBe("dismissed");
    await f.as(mine, () =>
      updateEquityHealthFinding(prisma, mine, { id: finding.id, status: "resolved" }),
    );
    const openAgain = await f.as(mine, () => createEquityHealthFinding(prisma, mine, input));
    expect(openAgain.status).toBe("open");
    expect(openAgain.dismissedAt).toBeNull();

    await f.as(mine, () =>
      createEquityHealthFinding(prisma, mine, {
        check: "missing_share_class",
        tag: "share_classes",
        severity: "recommended",
        fingerprint: "fp-2",
      }),
    );
    const filtered = await f.as(mine, () =>
      listEquityHealthFindings(prisma, mine, {
        page: 1,
        pageSize: 25,
        status: ["open"],
        severity: "recommended",
        tag: "share_classes",
        search: "share",
        sort: { field: "check", dir: "asc" },
      }),
    );
    EquityHealthFindingPageSchema.parse(filtered);
    expect(filtered.total).toBe(1);
    const desc = await f.as(mine, () =>
      listEquityHealthFindings(prisma, mine, {
        page: 1,
        pageSize: 1,
        sort: { field: "detectedAt", dir: "desc" },
      }),
    );
    expect(desc.total).toBe(2);
    expect(
      EquityHealthFindingSchema.parse(
        await f.as(mine, () => getEquityHealthFinding(prisma, mine, finding.id)),
      ).id,
    ).toBe(finding.id);
    await expect(
      f.as(sameSpace, () => getEquityHealthFinding(prisma, sameSpace, finding.id)),
    ).rejects.toThrow();
    await expect(
      f.as(otherSpace, () =>
        listEquityHealthFindings(prisma, otherSpace, { page: 1, pageSize: 25 }),
      ),
    ).resolves.toMatchObject({ total: 0 });
    await expect(
      f.as(mine, () =>
        createEquityHealthFinding(prisma, mine, { ...input, severity: "urgent" as never }),
      ),
    ).rejects.toThrow();
  });
});
