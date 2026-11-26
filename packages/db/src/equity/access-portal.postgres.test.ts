import { afterAll, beforeAll, expect, it } from "vitest";
import { setEquityAccessGrant } from "./access.js";
import { listEquityAccessHolders } from "./access-holders.js";
import { portalHoldings, portalRequestAccess } from "./access-portal.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describeEquityPostgres("equity portal holdings (PostgreSQL)", () => {
  let f: EquityFixture;
  const ids = {
    ann: "",
    bo: "",
    annContact: "",
    boContact: "",
    otherContact: "",
    strayContact: "",
  };
  beforeAll(async () => {
    f = await equityFixture("access-portal");
    const { prisma, mine, otherSpace, owner } = f;
    const make = (name: string, relationship: string) =>
      f.as(mine, () =>
        createEquityStakeholder(prisma, mine, {
          type: "individual",
          name,
          properties: [{ kind: "relationship", effectiveDate: "2020-01-01", value: relationship }],
        }),
      );
    ids.ann = (await make("Ann Holder", "employee")).id;
    ids.bo = (await make("Bo Investor", "investor")).id;
    const common = await owner.equityShareClass.create({
      data: { ...mine, name: "Common", prefix: "CS", classType: "common" },
    });
    await owner.equityCertificate.createMany({
      data: [
        {
          ...mine,
          label: "CS-1",
          stakeholderId: ids.ann,
          shareClassId: common.id,
          quantity: 100n,
          issueDate: day("2021-01-01"),
        },
        {
          ...mine,
          label: "CS-2",
          stakeholderId: ids.bo,
          shareClassId: common.id,
          quantity: 900n,
          issueDate: day("2021-01-01"),
        },
      ],
    });
    const contact = (scope: typeof mine, name: string) =>
      owner.contact.create({
        data: { ...scope, name, email: `${name.split(" ")[0]}@example.test` },
      });
    ids.annContact = (await contact(mine, "Ann Holder")).id;
    ids.boContact = (await contact(mine, "Bo Investor")).id;
    ids.strayContact = (await contact(mine, "Cal Unlinked")).id;
    ids.otherContact = (await contact(otherSpace, "Dee Elsewhere")).id;
    await owner.equityStakeholder.update({
      where: { id: ids.ann },
      data: { contactId: ids.annContact },
    });
    await owner.equityStakeholder.update({
      where: { id: ids.bo },
      data: { contactId: ids.boContact },
    });
    await f.as(mine, () =>
      setEquityAccessGrant(prisma, mine, { stakeholderId: ids.ann, level: "restricted" }),
    );
  });
  afterAll(async () => {
    await f?.close();
  });

  const principal = (scope: { spaceId: string; userId: string }, contactId: string) => ({
    ...scope,
    contactId,
  });

  it("a holder sees only their own holdings at their level", async () => {
    const { prisma, mine } = f;
    const ann = await portalHoldings(prisma, principal(mine, ids.annContact));
    expect(Object.keys(ann ?? {}).sort()).toEqual(["fairMarketValue", "level", "personal"]);
    expect(ann?.personal).toMatchObject({
      stakeholderId: ids.ann,
      holdings: [expect.objectContaining({ label: "CS-1" })],
    });
    expect(JSON.stringify(ann)).not.toMatch(/Bo Investor|CS-2/);
    const bo = await portalHoldings(prisma, principal(mine, ids.boContact));
    expect(bo?.level).toBe("advanced");
    expect(bo?.personal?.stakeholderId).toBe(ids.bo);
  });

  it("a contact without a stakeholder, of another space, or blocked sees nothing", async () => {
    const { prisma, mine, sameSpace, otherSpace, owner } = f;
    expect(await portalHoldings(prisma, principal(mine, ids.strayContact))).toEqual({
      level: "none",
    });
    // A principal whose scope does not own the contact: not a portal contact at all.
    expect(await portalHoldings(prisma, principal(sameSpace, ids.annContact))).toBeNull();
    expect(await portalHoldings(prisma, principal(otherSpace, ids.annContact))).toBeNull();
    expect(await portalHoldings(prisma, principal(mine, ids.otherContact))).toBeNull();
    expect(await portalHoldings(prisma, principal(otherSpace, ids.otherContact))).toEqual({
      level: "none",
    });
    await owner.contact.update({
      where: { id: ids.boContact },
      data: { portalBlockedAt: new Date() },
    });
    expect(await portalHoldings(prisma, principal(mine, ids.boContact))).toBeNull();
    await owner.contact.update({ where: { id: ids.boContact }, data: { portalBlockedAt: null } });
  });

  it("a holder can ask for more, only for themself", async () => {
    const { prisma, mine, otherSpace } = f;
    expect(await portalRequestAccess(prisma, principal(mine, ids.annContact), "restricted")).toBe(
      false,
    );
    expect(await portalRequestAccess(prisma, principal(mine, ids.annContact), "basic")).toBe(true);
    expect((await portalHoldings(prisma, principal(mine, ids.annContact)))?.requestedLevel).toBe(
      "basic",
    );
    expect((await portalHoldings(prisma, principal(mine, ids.boContact)))?.requestedLevel).toBe(
      undefined,
    );
    expect(
      await portalRequestAccess(prisma, principal(otherSpace, ids.annContact), "full_detail"),
    ).toBe(false);
    const open = await f.as(mine, () => listEquityAccessHolders(prisma, mine, { requested: true }));
    expect(open.items.map((row) => [row.stakeholderId, row.requestedLevel])).toEqual([
      [ids.ann, "basic"],
    ]);
  });
});
