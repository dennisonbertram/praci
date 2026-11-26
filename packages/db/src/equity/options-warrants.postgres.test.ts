import { EquityWarrantSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import {
  cancelEquityWarrant,
  createEquityWarrant,
  getEquityWarrant,
  listEquityWarrants,
} from "./options-warrants.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("warrants (PostgreSQL)", () => {
  let f: EquityFixture;
  let stakeholderId: string;
  let shareClassId: string;
  let foreignStakeholderId: string;

  beforeAll(async () => {
    f = await equityFixture("options-warrants");
    const { owner, mine, otherSpace } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    await owner.equityLedger.create({ data: scope });
    stakeholderId = (
      await owner.equityStakeholder.create({
        data: { ...scope, type: "organization", name: "Lender Example LLC" },
      })
    ).id;
    shareClassId = (
      await owner.equityShareClass.create({
        data: { ...scope, name: "Series A Preferred", classType: "preferred", prefix: "PA" },
      })
    ).id;
    const theirs = { spaceId: otherSpace.spaceId, userId: otherSpace.userId };
    await owner.equityLedger.create({ data: theirs });
    foreignStakeholderId = (
      await owner.equityStakeholder.create({
        data: { ...theirs, type: "individual", name: "Someone Else" },
      })
    ).id;
  });

  afterAll(async () => {
    await f?.close();
  });

  it("issues, lists, searches and cancels warrants", async () => {
    const { prisma, mine, owner } = f;
    const first = await f.as(mine, () =>
      createEquityWarrant(prisma, mine, {
        stakeholderId,
        shareClassId,
        quantity: "25000",
        exercisePrice: "1.25",
        issueDate: "2025-03-01",
      }),
    );
    EquityWarrantSchema.parse(first);
    expect(first.label).toBe("W-1");
    const second = await f.as(mine, () =>
      createEquityWarrant(prisma, mine, {
        stakeholderId,
        shareClassId,
        quantity: "5000",
        exercisePrice: "2",
        issueDate: "2025-06-01",
      }),
    );
    expect(second.label).toBe("W-2");
    const page = await f.as(mine, () =>
      listEquityWarrants(prisma, mine, { sort: { field: "quantity", dir: "asc" } }),
    );
    expect(page.items.map((row) => row.label)).toEqual(["W-2", "W-1"]);
    const found = await f.as(mine, () => listEquityWarrants(prisma, mine, { search: "lender" }));
    expect(found.total).toBe(2);
    const canceled = await f.as(mine, () =>
      cancelEquityWarrant(prisma, mine, { id: first.id, canceledOn: "2025-09-01" }),
    );
    expect(canceled.status).toBe("canceled");
    await expect(
      f.as(mine, () =>
        cancelEquityWarrant(prisma, mine, { id: first.id, canceledOn: "2025-09-02" }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const open = await f.as(mine, () =>
      listEquityWarrants(prisma, mine, { status: ["outstanding"] }),
    );
    expect(open.items.map((row) => row.label)).toEqual(["W-2"]);
    const kinds = await owner.equityTransaction.findMany({
      where: { spaceId: mine.spaceId, userId: mine.userId, note: "warrant" },
      select: { kind: true },
    });
    expect(kinds.map((row) => row.kind).sort()).toEqual(["cancel", "issue", "issue"]);
  });

  it("keeps other tenants out and refuses their stakeholders", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const warrant = (await f.as(mine, () => listEquityWarrants(prisma, mine, {}))).items[0]!;
    for (const scope of [sameSpace, otherSpace]) {
      await expect(
        f.as(scope, () => getEquityWarrant(prisma, scope, warrant.id)),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () =>
          cancelEquityWarrant(prisma, scope, { id: warrant.id, canceledOn: "2025-10-01" }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      expect((await f.as(scope, () => listEquityWarrants(prisma, scope, {}))).total).toBe(0);
    }
    await expect(
      f.as(mine, () =>
        createEquityWarrant(prisma, mine, {
          stakeholderId: foreignStakeholderId,
          shareClassId,
          quantity: "1",
          exercisePrice: "1",
          issueDate: "2025-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });
});
