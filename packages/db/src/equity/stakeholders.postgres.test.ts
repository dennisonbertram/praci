import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError, recordTransaction } from "./ledger.js";
import {
  createEquityCustomProperty,
  createEquityStakeholder,
  currentProperties,
  getEquityStakeholder,
  listEquityStakeholders,
  updateEquityStakeholder,
} from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity stakeholders (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("stakeholders");
  });
  afterAll(async () => {
    await f?.close();
  });

  it("creates, reads, updates and lists with sort, filter, search and pages", async () => {
    const { prisma, mine } = f;
    const ada = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Ada Example",
        contactEmail: "ada@example.test",
        addresses: [
          {
            country: "US",
            street: "1 Main St",
            city: "Springfield",
            state: "CA",
            postalCode: "90000",
          },
        ],
        properties: [
          { kind: "relationship", effectiveDate: "2020-01-01", value: "employee" },
          { kind: "relationship", effectiveDate: "2023-06-01", value: "ex_employee" },
          { kind: "cost_center", effectiveDate: "2020-01-01", value: "R&D" },
        ],
      }),
    );
    expect(ada.relationship).toBe("ex_employee");
    expect(ada.costCenter).toBe("R&D");
    expect(ada.addressCompleteness).toBe("complete");
    expect(ada.properties).toHaveLength(3);
    for (const name of ["Ben Sample", "Cy Placeholder"])
      await f.as(mine, () => createEquityStakeholder(prisma, mine, { type: "individual", name }));
    await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, { type: "organization", name: "Example Ventures" }),
    );

    const page = await f.as(mine, () =>
      listEquityStakeholders(prisma, mine, { sort: { field: "name", dir: "desc" }, pageSize: 2 }),
    );
    expect(page.total).toBe(4);
    expect(page.items.map((row) => row.name)).toEqual(["Example Ventures", "Cy Placeholder"]);
    const second = await f.as(mine, () =>
      listEquityStakeholders(prisma, mine, {
        sort: { field: "name", dir: "desc" },
        pageSize: 2,
        page: 2,
      }),
    );
    expect(second.items.map((row) => row.name)).toEqual(["Ben Sample", "Ada Example"]);
    const orgs = await f.as(mine, () =>
      listEquityStakeholders(prisma, mine, { type: "organization" }),
    );
    expect(orgs.items.map((row) => row.name)).toEqual(["Example Ventures"]);
    const none = await f.as(mine, () =>
      listEquityStakeholders(prisma, mine, { relationship: ["none"] }),
    );
    expect(none.total).toBe(3);
    const search = await f.as(mine, () => listEquityStakeholders(prisma, mine, { search: "ADA@" }));
    expect(search.items.map((row) => row.id)).toEqual([ada.id]);
    const noAddress = await f.as(mine, () =>
      listEquityStakeholders(prisma, mine, { addressCompleteness: ["none"] }),
    );
    expect(noAddress.total).toBe(3);

    const updated = await f.as(mine, () =>
      updateEquityStakeholder(prisma, mine, {
        id: ada.id,
        majorInvestor: true,
        properties: [{ kind: "relationship", effectiveDate: "2020-01-01", value: "founder" }],
      }),
    );
    expect(updated.majorInvestor).toBe(true);
    expect(updated.relationship).toBe("founder");
    expect(updated.costCenter).toBe("R&D");
    expect(updated.contactEmail).toBe("ada@example.test");
  });

  it("refuses unknown references and a locked portfolio email", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () =>
        createEquityStakeholder(prisma, mine, {
          type: "individual",
          name: "Orphan",
          parentId: "missing",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        createEquityStakeholder(prisma, mine, {
          type: "individual",
          name: "Custom",
          customValues: { missing: "x" },
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const prop = await f.as(mine, () =>
      createEquityCustomProperty(prisma, mine, { name: "T-shirt size" }),
    );
    await expect(
      f.as(mine, () => createEquityCustomProperty(prisma, mine, { name: "T-shirt size" })),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const holder = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Locked Holder",
        portfolioEmail: "locked@example.test",
        customValues: { [prop.id]: "M" },
      }),
    );
    expect(holder.customValues).toEqual({ [prop.id]: "M" });
    await f.owner.equityStakeholder.update({
      where: { id: holder.id },
      data: { portfolioEmailLockedAt: new Date() },
    });
    await expect(
      f.as(mine, () =>
        updateEquityStakeholder(prisma, mine, {
          id: holder.id,
          portfolioEmail: "new@example.test",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("keeps another user's and another space's ledger apart", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const [mineRow] = (await f.as(mine, () => listEquityStakeholders(prisma, mine, {}))).items;
    for (const other of [sameSpace, otherSpace]) {
      expect((await f.as(other, () => listEquityStakeholders(prisma, other, {}))).total).toBe(0);
      await expect(
        f.as(other, () => getEquityStakeholder(prisma, other, mineRow!.id)),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(other, () => updateEquityStakeholder(prisma, other, { id: mineRow!.id, name: "X" })),
      ).rejects.toBeInstanceOf(IsolationError);
      // A reference to someone else's row is refused, even though the id exists.
      await expect(
        f.as(other, () =>
          createEquityStakeholder(prisma, other, {
            type: "individual",
            name: "Fund",
            parentId: mineRow!.id,
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    }
    // Row-level security backs up the filters: under another tenant's context, a store called
    // with this user's scope still sees nothing.
    if (process.env.DATABASE_MIGRATION_URL !== process.env.DATABASE_URL)
      expect((await f.as(sameSpace, () => listEquityStakeholders(prisma, mine, {}))).total).toBe(0);
  });

  it("keeps transactions append-only for the app", async () => {
    const { prisma, mine } = f;
    const id = await f.as(mine, () =>
      recordTransaction(prisma, mine, { kind: "issue", effectiveDate: "2024-01-01" }),
    );
    const usesRuntimeLogin = process.env.DATABASE_MIGRATION_URL !== process.env.DATABASE_URL;
    const changed = await f.as(mine, () =>
      prisma.equityTransaction.updateMany({ where: { id }, data: { note: "changed" } }),
    );
    const removed = await f.as(mine, () => prisma.equityTransaction.deleteMany({ where: { id } }));
    if (usesRuntimeLogin) {
      expect(changed.count).toBe(0);
      expect(removed.count).toBe(0);
    }
  });

  it("picks the latest dated value on or before the date", () => {
    expect(
      currentProperties(
        [
          { kind: "job_title", effectiveDate: "2020-01-01", value: "Engineer" },
          { kind: "job_title", effectiveDate: "2030-01-01", value: "Future" },
        ],
        "2026-01-01",
      ).jobTitle,
    ).toBe("Engineer");
  });
});
