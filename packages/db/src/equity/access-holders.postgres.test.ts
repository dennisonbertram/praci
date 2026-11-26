import { EquityAccessHolderPageSchema, EquityAccessHolderSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { setEquityAccessGroup } from "./access.js";
import {
  linkEquityHolderContact,
  listEquityAccessHolders,
  requestEquityAccess,
  resolveEquityAccessRequest,
  setEquityAccessLevels,
} from "./access-holders.js";
import { equityHolderView } from "./access-view.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const person = (name: string, relationship: string) => ({
  type: "individual" as const,
  name,
  contactEmail: `${name.split(" ")[0]!.toLowerCase()}@example.test`,
  properties: [{ kind: "relationship" as const, effectiveDate: "2020-01-01", value: relationship }],
});
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describeEquityPostgres("equity access holders (PostgreSQL)", () => {
  let f: EquityFixture;
  const ids = { founder: "", investor: "", employee: "", nobody: "", foreign: "" };
  let preferredId = "";
  beforeAll(async () => {
    f = await equityFixture("access-holders");
    const { prisma, mine, otherSpace, owner } = f;
    const make = (name: string, relationship: string) =>
      f.as(mine, () => createEquityStakeholder(prisma, mine, person(name, relationship)));
    ids.founder = (await make("Ada Founder", "founder")).id;
    ids.investor = (await make("Ben Investor", "investor")).id;
    ids.employee = (await make("Cy Employee", "employee")).id;
    ids.nobody = (await make("Di Nobody", "other")).id;
    ids.foreign = (
      await f.as(otherSpace, () =>
        createEquityStakeholder(prisma, otherSpace, person("Ed Elsewhere", "investor")),
      )
    ).id;
    const common = await owner.equityShareClass.create({
      data: { ...mine, name: "Common", prefix: "CS", classType: "common" },
    });
    const preferred = await owner.equityShareClass.create({
      data: { ...mine, name: "Series A Preferred", prefix: "PA", classType: "preferred" },
    });
    preferredId = preferred.id;
    await owner.equityCertificate.createMany({
      data: [
        {
          ...mine,
          label: "CS-1",
          stakeholderId: ids.founder,
          shareClassId: common.id,
          quantity: 3_000_000n,
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
          stakeholderId: ids.employee,
          shareClassId: common.id,
          quantity: 1_000_000n,
          issueDate: day("2022-02-01"),
        },
      ],
    });
    const contact = await owner.contact.create({
      data: {
        ...mine,
        name: "Ben Investor",
        email: "ben@example.test",
        portalLastSeenAt: new Date("2026-10-01T12:00:00.000Z"),
      },
    });
    await owner.equityStakeholder.update({
      where: { id: ids.investor },
      data: { contactId: contact.id },
    });
  });
  afterAll(async () => {
    await f?.close();
  });

  it("lists holders with ownership, classes, levels and last seen", async () => {
    const { prisma, mine } = f;
    const page = await f.as(mine, () => listEquityAccessHolders(prisma, mine, {}));
    EquityAccessHolderPageSchema.parse(page);
    expect(page.items.map((row) => row.name)).toEqual([
      "Ada Founder",
      "Ben Investor",
      "Cy Employee",
      "Di Nobody",
    ]);
    const ben = page.items[1]!;
    expect(ben).toMatchObject({
      ownershipPercent: "20.0000",
      classCodes: ["PA"],
      group: "investors",
      groupLevel: "advanced",
      effectiveLevel: "advanced",
      lastSeenAt: "2026-10-01T12:00:00.000Z",
    });
    expect(ben.contactId).not.toBeNull();
    expect(page.items[0]!.contactId).toBeNull();
    expect(page.items[0]!.ownershipPercent).toBe("60.0000");
    expect(page.items[3]!.effectiveLevel).toBe("none");
  });

  it("filters, sorts and pages", async () => {
    const { prisma, mine } = f;
    const list = (input: Record<string, unknown>) =>
      f
        .as(mine, () => listEquityAccessHolders(prisma, mine, input))
        .then((page) => page.items.map((row) => row.name.split(" ")[0]));
    const byOwnership = await list({ sort: { field: "ownership", dir: "desc" } });
    expect([byOwnership[0], byOwnership[3]]).toEqual(["Ada", "Di"]);
    expect(await list({ sort: { field: "effectiveLevel", dir: "asc" } })).toEqual([
      "Di",
      "Cy",
      "Ben",
      "Ada",
    ]);
    expect((await list({ sort: { field: "lastSeenAt", dir: "desc" } }))[0]).toBe("Ben");
    expect(await list({ level: ["none"] })).toEqual(["Di"]);
    expect(await list({ group: ["employees"] })).toEqual(["Cy"]);
    expect(await list({ shareClassId: preferredId })).toEqual(["Ben"]);
    expect(await list({ search: "cy@example" })).toEqual(["Cy"]);
    expect(await list({ page: 2, pageSize: 3 })).toEqual(["Di"]);
  });

  it("bulk set is all or nothing, and an override beats the group", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () =>
        setEquityAccessLevels(prisma, mine, {
          stakeholderIds: [ids.employee, ids.foreign],
          level: "full_detail",
        }),
      ),
    ).rejects.toThrow(/not in this cap table/);
    const untouched = await f.as(mine, () =>
      listEquityAccessHolders(prisma, mine, { group: ["employees"] }),
    );
    expect(untouched.items[0]!.overrideLevel).toBeNull();
    const rows = await f.as(mine, () =>
      setEquityAccessLevels(prisma, mine, {
        stakeholderIds: [ids.employee, ids.founder],
        level: "restricted",
      }),
    );
    for (const row of rows) EquityAccessHolderSchema.parse(row);
    expect(rows.map((row) => row.effectiveLevel)).toEqual(["restricted", "restricted"]);
    await f.as(mine, () =>
      setEquityAccessGroup(prisma, mine, { key: "employees", level: "full_detail" }),
    );
    const after = await f.as(mine, () =>
      listEquityAccessHolders(prisma, mine, { group: ["employees"] }),
    );
    expect(after.items[0]).toMatchObject({
      groupLevel: "full_detail",
      effectiveLevel: "restricted",
    });
    await f.as(mine, () =>
      setEquityAccessLevels(prisma, mine, {
        stakeholderIds: [ids.employee, ids.founder],
        level: null,
      }),
    );
    await f.as(mine, () =>
      setEquityAccessGroup(prisma, mine, { key: "employees", level: "basic" }),
    );
  });

  it("requests: ask for more, approve or deny, both close it", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () =>
        requestEquityAccess(prisma, mine, { stakeholderId: ids.investor, level: "basic" }),
      ),
    ).rejects.toThrow(/more than/);
    const asked = await f.as(mine, () =>
      requestEquityAccess(prisma, mine, { stakeholderId: ids.investor, level: "full_detail" }),
    );
    expect(asked.requestedLevel).toBe("full_detail");
    expect(
      (await f.as(mine, () => listEquityAccessHolders(prisma, mine, { requested: true }))).total,
    ).toBe(1);
    const approved = await f.as(mine, () =>
      resolveEquityAccessRequest(prisma, mine, {
        stakeholderId: ids.investor,
        requestedLevel: "full_detail",
        approve: true,
      }),
    );
    expect(approved).toMatchObject({
      overrideLevel: "full_detail",
      requestedLevel: null,
      requestedAt: null,
    });
    await expect(
      f.as(mine, () =>
        resolveEquityAccessRequest(prisma, mine, {
          stakeholderId: ids.investor,
          requestedLevel: "full_detail",
          approve: true,
        }),
      ),
    ).rejects.toThrow(/no open request/);
    await f.as(mine, () =>
      requestEquityAccess(prisma, mine, { stakeholderId: ids.employee, level: "full_detail" }),
    );
    const denied = await f.as(mine, () =>
      resolveEquityAccessRequest(prisma, mine, {
        stakeholderId: ids.employee,
        requestedLevel: "full_detail",
        approve: false,
      }),
    );
    expect(denied).toMatchObject({
      overrideLevel: null,
      effectiveLevel: "basic",
      requestedLevel: null,
    });
  });

  it("approves only the level the owner reviewed, not one the holder swapped in", async () => {
    const { prisma, mine, owner } = f;
    await f.as(mine, () =>
      requestEquityAccess(prisma, mine, { stakeholderId: ids.employee, level: "advanced" }),
    );
    // The holder re-requests a higher level after the owner opened "advanced".
    await f.as(mine, () =>
      requestEquityAccess(prisma, mine, { stakeholderId: ids.employee, level: "full_detail" }),
    );
    await expect(
      f.as(mine, () =>
        resolveEquityAccessRequest(prisma, mine, {
          stakeholderId: ids.employee,
          requestedLevel: "advanced",
          approve: true,
        }),
      ),
    ).rejects.toThrow(/request changed/);
    const grant = await owner.equityAccessGrant.findFirstOrThrow({
      where: { stakeholderId: ids.employee },
    });
    expect(grant).toMatchObject({ level: null, requestedLevel: "full_detail" });
    await f.as(mine, () =>
      resolveEquityAccessRequest(prisma, mine, {
        stakeholderId: ids.employee,
        requestedLevel: "full_detail",
        approve: false,
      }),
    );
  });

  it("counts a warrant as a holding for access level and view", async () => {
    const { prisma, mine, owner } = f;
    const holder = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, person("Wes Warrant", "advisor")),
    );
    const before = await f.as(mine, () => listEquityAccessHolders(prisma, mine, { search: "Wes" }));
    expect(before.items[0]!.effectiveLevel).toBe("none");
    const common = await owner.equityShareClass.findFirstOrThrow({
      where: { ...mine, prefix: "CS" },
    });
    await owner.equityWarrant.create({
      data: {
        ...mine,
        label: "W-1",
        stakeholderId: holder.id,
        shareClassId: common.id,
        quantity: 500n,
        exercisePrice: "1.5",
        issueDate: day("2021-05-01"),
      },
    });
    const after = await f.as(mine, () => listEquityAccessHolders(prisma, mine, { search: "Wes" }));
    expect(after.items[0]!.effectiveLevel).not.toBe("none");
    const view = await f.as(mine, () => equityHolderView(prisma, mine, holder.id));
    expect(view.personal?.holdings).toEqual([
      expect.objectContaining({ kind: "warrant", label: "W-1", quantity: "500" }),
    ]);
  });

  it("another user or space cannot list, set, request or resolve", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace]) {
      const page = await f.as(scope, () => listEquityAccessHolders(prisma, scope, {}));
      expect(page.items.map((row) => row.stakeholderId)).not.toContain(ids.founder);
      await expect(
        f.as(scope, () =>
          setEquityAccessLevels(prisma, scope, {
            stakeholderIds: [ids.founder],
            level: "full_detail",
          }),
        ),
      ).rejects.toThrow();
      await expect(
        f.as(scope, () =>
          requestEquityAccess(prisma, scope, { stakeholderId: ids.founder, level: "full_detail" }),
        ),
      ).rejects.toThrow(/not found/i);
      await expect(
        f.as(scope, () =>
          resolveEquityAccessRequest(prisma, scope, {
            stakeholderId: ids.founder,
            requestedLevel: "full_detail",
            approve: true,
          }),
        ),
      ).rejects.toThrow(/not found/i);
    }
    const mineAfter = await f.as(mine, () =>
      listEquityAccessHolders(prisma, mine, { search: "Ada" }),
    );
    expect(mineAfter.items[0]).toMatchObject({ overrideLevel: null, requestedLevel: null });
  });

  it("links a holder to one investor contact of the same ledger owner", async () => {
    const { prisma, mine, sameSpace, otherSpace, owner } = f;
    const contact = await owner.contact.create({
      data: { ...mine, name: "Di Nobody", email: "di@example.test", kind: "investor" },
    });
    const prospect = await owner.contact.create({
      data: { ...mine, name: "Not an investor", kind: "customer" },
    });
    const foreign = await owner.contact.create({
      data: { ...otherSpace, name: "Elsewhere", kind: "investor" },
    });
    const linked = await f.as(mine, () =>
      linkEquityHolderContact(prisma, mine, { stakeholderId: ids.nobody, contactId: contact.id }),
    );
    expect(linked.contactId).toBe(contact.id);
    await expect(
      f.as(mine, () =>
        linkEquityHolderContact(prisma, mine, {
          stakeholderId: ids.founder,
          contactId: contact.id,
        }),
      ),
    ).rejects.toThrow(/already linked to Di Nobody/);
    for (const other of [prospect.id, foreign.id])
      await expect(
        f.as(mine, () =>
          linkEquityHolderContact(prisma, mine, { stakeholderId: ids.founder, contactId: other }),
        ),
      ).rejects.toThrow(/Unknown investor contact/);
    for (const scope of [sameSpace, otherSpace])
      await expect(
        f.as(scope, () =>
          linkEquityHolderContact(prisma, scope, { stakeholderId: ids.nobody, contactId: null }),
        ),
      ).rejects.toThrow(/not found/i);
    const unlinked = await f.as(mine, () =>
      linkEquityHolderContact(prisma, mine, { stakeholderId: ids.nobody, contactId: null }),
    );
    expect(unlinked.contactId).toBeNull();
  });
});
