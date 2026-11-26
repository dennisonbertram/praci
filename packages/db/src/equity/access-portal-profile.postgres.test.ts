import { afterAll, beforeAll, expect, it } from "vitest";
import { portalHoldings, portalProposeProfileChange } from "./access-portal.js";
import { createEquityStakeholder } from "./stakeholders.js";
import { resolveEquityStakeholderChange } from "./stakeholders-changes.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtEquityLedgerLock,
  describeEquityPostgres,
  equityFixture,
} from "./test-fixture.js";
import { pauseAfter } from "./test-interleave.js";
import { setEquityEstimatedValue } from "./views-value.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describeEquityPostgres("equity portal: estimated value and profile changes (PostgreSQL)", () => {
  let f: EquityFixture;
  const ids = {
    ann: "",
    bo: "",
    annContact: "",
    boContact: "",
    strayContact: "",
    foreignContact: "",
  };
  beforeAll(async () => {
    f = await equityFixture("access-portal-profile");
    const { prisma, mine, otherSpace, owner } = f;
    const make = (name: string) =>
      f.as(mine, () => createEquityStakeholder(prisma, mine, { type: "individual", name }));
    ids.ann = (await make("Ann Holder")).id;
    ids.bo = (await make("Bo Holder")).id;
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
          quantity: 1000n,
          issueDate: day("2021-01-01"),
        },
        {
          ...mine,
          label: "CS-2",
          stakeholderId: ids.bo,
          shareClassId: common.id,
          quantity: 3n,
          issueDate: day("2021-01-01"),
        },
      ],
    });
    const contact = (scope: typeof mine, name: string) =>
      owner.contact.create({
        data: { ...scope, name, email: `${name.split(" ")[0]}@example.test` },
      });
    ids.annContact = (await contact(mine, "Ann Holder")).id;
    ids.boContact = (await contact(mine, "Bo Holder")).id;
    ids.strayContact = (await contact(mine, "Cal Unlinked")).id;
    ids.foreignContact = (await contact(otherSpace, "Dee Elsewhere")).id;
    await owner.equityStakeholder.update({
      where: { id: ids.ann },
      data: { contactId: ids.annContact },
    });
    await owner.equityStakeholder.update({
      where: { id: ids.bo },
      data: { contactId: ids.boContact },
    });
  });
  afterAll(async () => {
    await f?.close();
  });
  const principal = (scope: { spaceId: string; userId: string }, contactId: string) => ({
    ...scope,
    contactId,
  });

  it("shows the estimated value only when the company shows holders a price, for their own shares", async () => {
    const { prisma, mine } = f;
    expect(
      (await portalHoldings(prisma, principal(mine, ids.annContact)))?.estimatedValue,
    ).toBeUndefined();
    await f.as(mine, () =>
      setEquityEstimatedValue(prisma, mine, {
        visibility: "hidden",
        pricePerShare: "1.255",
        effectiveDate: "2026-06-30",
      }),
    );
    expect(
      (await portalHoldings(prisma, principal(mine, ids.annContact)))?.estimatedValue,
    ).toBeUndefined();
    await f.as(mine, () =>
      setEquityEstimatedValue(prisma, mine, {
        visibility: "holders",
        pricePerShare: "1.255",
        effectiveDate: "2026-06-30",
      }),
    );
    const ann = await portalHoldings(prisma, principal(mine, ids.annContact));
    expect(ann?.estimatedValue).toEqual({
      pricePerShare: "1.255",
      effectiveDate: "2026-06-30",
      valueCents: "125500",
    });
    expect(ann?.fairMarketValue).toEqual({ pricePerShare: "1.255", effectiveDate: "2026-06-30" });
    // 3 x $1.255 = $3.765 -> 377 cents, half up; never Ann's figure.
    expect(
      (await portalHoldings(prisma, principal(mine, ids.boContact)))?.estimatedValue?.valueCents,
    ).toBe("377");
  });

  it("queues a holder's profile change for their own record only", async () => {
    const { prisma, mine, sameSpace, otherSpace, owner } = f;
    expect(
      await portalProposeProfileChange(prisma, principal(mine, ids.annContact), {
        lastName: "Holder-Smith",
        contactEmail: "Ann.New@Example.test",
      }),
    ).toBe(true);
    // A second proposal supersedes the pending one: the reviewed row is rejected, never edited.
    await portalProposeProfileChange(prisma, principal(mine, ids.annContact), {
      lastName: "Holder-Jones",
      address: { city: "Springfield", country: "US" },
    });
    const rows = await owner.equityStakeholderChange.findMany({ where: { spaceId: mine.spaceId } });
    expect(rows.map((row) => row.status).sort()).toEqual(["pending", "rejected"]);
    const current = rows.find((row) => row.status === "pending")!;
    expect(current).toMatchObject({ stakeholderId: ids.ann, kind: "profile", source: "portal" });
    expect(rows.find((row) => row.status === "rejected")!.proposed).toMatchObject({
      lastName: "Holder-Smith",
    });
    expect(current.proposed).toMatchObject({
      lastName: "Holder-Jones",
      address: { city: "Springfield" },
    });
    // Nothing on the record itself changed.
    expect((await owner.equityStakeholder.findUniqueOrThrow({ where: { id: ids.ann } })).name).toBe(
      "Ann Holder",
    );
    // Unlinked contacts, other owners of the contact and another space's contact queue nothing.
    expect(
      await portalProposeProfileChange(prisma, principal(mine, ids.strayContact), {
        lastName: "X",
      }),
    ).toBe(false);
    expect(
      await portalProposeProfileChange(prisma, principal(sameSpace, ids.annContact), {
        lastName: "X",
      }),
    ).toBe(false);
    expect(
      await portalProposeProfileChange(prisma, principal(otherSpace, ids.annContact), {
        lastName: "X",
      }),
    ).toBe(false);
    expect(
      await portalProposeProfileChange(prisma, principal(otherSpace, ids.foreignContact), {
        lastName: "X",
      }),
    ).toBe(false);
    expect(await owner.equityStakeholderChange.count({ where: { stakeholderId: ids.bo } })).toBe(0);
    expect(await owner.equityStakeholderChange.count()).toBeGreaterThanOrEqual(1);
    await expect(
      portalProposeProfileChange(prisma, principal(mine, ids.annContact), {
        stakeholderId: ids.bo,
        lastName: "X",
      }),
    ).rejects.toThrow();
    await expect(
      portalProposeProfileChange(prisma, principal(mine, ids.annContact), {}),
    ).rejects.toThrow();
  });

  it("keeps one pending change when a holder proposes twice at the same time", async () => {
    const { prisma, mine, owner } = f;
    // Both proposals are in flight before either takes the ledger lock. The unique index alone
    // would make the loser fail; both succeeding means the lock made the second reject the first.
    const together = barrierAtEquityLedgerLock(prisma);
    const propose = (lastName: string) =>
      portalProposeProfileChange(together, principal(mine, ids.boContact), { lastName });
    const results = await Promise.allSettled([propose("Holder-A"), propose("Holder-B")]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const rows = await owner.equityStakeholderChange.findMany({ where: { stakeholderId: ids.bo } });
    expect(rows.map((row) => row.status).sort()).toEqual(["pending", "rejected"]);
  });

  it("does not deadlock when a reviewer accepts while the holder proposes again", async () => {
    const { prisma, mine, owner } = f;
    const cy = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, { type: "individual", name: "Cy Holder" }),
    );
    const cyContact = await owner.contact.create({
      data: { ...mine, name: "Cy Holder", email: "cy@example.test" },
    });
    await owner.equityStakeholder.update({
      where: { id: cy.id },
      data: { contactId: cyContact.id },
    });
    await portalProposeProfileChange(prisma, principal(mine, cyContact.id), { lastName: "First" });
    const pending = await owner.equityStakeholderChange.findFirstOrThrow({
      where: { stakeholderId: cy.id, status: "pending" },
    });
    // Freeze the reviewer right after it claimed the change row, then start the proposal. With
    // the old order (change row, then holder) the proposal held the holder row and waited for the
    // change row while the reviewer waited for the holder row: Postgres reports a deadlock.
    const paused = pauseAfter(prisma, "equityStakeholderChange", "updateMany");
    const accept = f.as(mine, () =>
      resolveEquityStakeholderChange(paused.prisma, mine, {
        id: pending.id,
        decision: "accept",
        fields: ["lastName"],
      }),
    );
    await paused.reached;
    const propose = portalProposeProfileChange(prisma, principal(mine, cyContact.id), {
      lastName: "Second",
    });
    for (let tries = 0; ; tries++) {
      const [{ waiting }] = await owner.$queryRaw<[{ waiting: bigint }]>`
        SELECT count(*) AS waiting FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND datname = current_database()`;
      if (waiting > 0n) break;
      if (tries > 500) throw new Error("The proposal never waited on the reviewer");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    paused.resume();
    const results = await Promise.allSettled([accept, propose]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(
      (await owner.equityStakeholder.findUniqueOrThrow({ where: { id: cy.id } })).lastName,
    ).toBe("First");
    const rows = await owner.equityStakeholderChange.findMany({ where: { stakeholderId: cy.id } });
    expect(rows.filter((row) => row.status === "pending").map((row) => row.proposed)).toEqual([
      { lastName: "Second" },
    ]);
  });
});
