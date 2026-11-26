import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import { createEquityDraftSet, updateEquityDraftSet } from "./rounds.js";
import { listEquityCertificates, listEquityTransactions } from "./securities.js";
import { issueEquityDraftSet, reviewEquityDraftSet } from "./securities-drafts.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtEquityLedgerLock,
  describeEquityPostgres,
  equityFixture,
} from "./test-fixture.js";

describeEquityPostgres("equity draft sets (PostgreSQL)", () => {
  let f: EquityFixture;
  let classId = "";
  let adaId = "";

  beforeAll(async () => {
    f = await equityFixture("draft-sets");
    adaId = (
      await f.as(f.mine, () =>
        createEquityStakeholder(f.prisma, f.mine, { type: "individual", name: "Ada Example" }),
      )
    ).id;
    const row = await f.owner.equityShareClass.create({
      data: { ...f.mine, name: "Common", prefix: "CS", classType: "common" },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        ...f.mine,
        shareClassId: row.id,
        documentDate: new Date("2024-01-01T00:00:00Z"),
        authorizedShares: 10_000_000n,
      },
    });
    classId = row.id;
  });

  afterAll(async () => {
    await f?.close();
  });

  const share = (quantity: string) => ({
    stakeholderId: adaId,
    shareClassId: classId,
    quantity,
    issueDate: "2025-01-02",
  });

  it("reviews, then issues every certificate once", async () => {
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "January grants",
        securityKind: "certificate",
        items: [share("1000"), { ...share("2500"), pricePerShare: "0.10" }],
      }),
    );
    const review = await f.as(f.mine, () =>
      reviewEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
    );
    expect(review).toMatchObject({ ready: true, totalShares: "3500", revision: set.revision });
    const interleaved = barrierAtEquityLedgerLock(f.prisma);
    const [result, concurrentRetry] = await Promise.all([
      f.as(f.mine, () =>
        issueEquityDraftSet(interleaved, f.mine, { id: set.id, expectedRevision: set.revision }),
      ),
      f.as(f.mine, () =>
        issueEquityDraftSet(interleaved, f.mine, { id: set.id, expectedRevision: set.revision }),
      ),
    ]);
    expect(result.set.status).toBe("issued");
    expect(result.issuedIds).toHaveLength(2);
    expect(concurrentRetry.issuedIds).toEqual(result.issuedIds);
    const page = await f.as(f.mine, () =>
      listEquityCertificates(f.prisma, f.mine, { pageSize: 50 }),
    );
    expect(page.items.map((row) => row.quantity).sort()).toEqual(["1000", "2500"]);
    // A priced row records its cash paid (2,500 x $0.10), so it counts toward amount raised.
    expect(page.items.find((row) => row.quantity === "2500")?.cashPaidCents).toBe("25000");
    expect(page.items.find((row) => row.quantity === "1000")?.cashPaidCents).toBe("0");
    const issues = await f.as(f.mine, () =>
      listEquityTransactions(f.prisma, f.mine, { kind: ["issue"], pageSize: 50 }),
    );
    expect(issues.total).toBe(2);
    const retry = await f.as(f.mine, () =>
      issueEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
    );
    expect(retry.issuedIds).toEqual(result.issuedIds);
    expect(retry.set.issuedIds).toEqual(result.issuedIds);
  });

  it("issues SAFEs and refuses a set over the authorized shares without issuing any", async () => {
    const safes = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Seed SAFEs",
        securityKind: "convertible",
        items: [
          {
            stakeholderId: adaId,
            kind: "safe",
            principalCents: "5000000",
            issueDate: "2025-01-03",
          },
        ],
      }),
    );
    const issued = await f.as(f.mine, () =>
      issueEquityDraftSet(f.prisma, f.mine, { id: safes.id, expectedRevision: safes.revision }),
    );
    expect(issued.issuedIds).toHaveLength(1);
    const big = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Too big",
        securityKind: "certificate",
        items: [share("100"), share("20000000")],
      }),
    );
    await expect(
      f.as(f.mine, () =>
        issueEquityDraftSet(f.prisma, f.mine, { id: big.id, expectedRevision: big.revision }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const page = await f.as(f.mine, () =>
      listEquityCertificates(f.prisma, f.mine, { pageSize: 50 }),
    );
    expect(page.total).toBe(2);
  });

  it("keeps another user and another space out", async () => {
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Private",
        securityKind: "certificate",
        items: [share("10")],
      }),
    );
    for (const scope of [f.sameSpace, f.otherSpace]) {
      await expect(
        f.as(scope, () =>
          reviewEquityDraftSet(f.prisma, scope, { id: set.id, expectedRevision: set.revision }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () =>
          issueEquityDraftSet(f.prisma, scope, { id: set.id, expectedRevision: set.revision }),
        ),
      ).rejects.toThrow();
    }
  });

  it("serializes issue against editing and discarding", async () => {
    const create = (name: string) =>
      f.as(f.mine, () =>
        createEquityDraftSet(f.prisma, f.mine, {
          name,
          securityKind: "certificate",
          items: [share("10")],
        }),
      );
    const editSet = await create("Issue versus edit");
    const editGate = barrierAtEquityLedgerLock(f.prisma);
    const editRace = await Promise.allSettled([
      f.as(f.mine, () =>
        issueEquityDraftSet(editGate, f.mine, {
          id: editSet.id,
          expectedRevision: editSet.revision,
        }),
      ),
      f.as(f.mine, () =>
        updateEquityDraftSet(editGate, f.mine, {
          id: editSet.id,
          expectedRevision: editSet.revision,
          name: "Edited first",
        }),
      ),
    ]);
    expect(editRace.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const edited = await f.owner.equityDraftSet.findUniqueOrThrow({ where: { id: editSet.id } });
    if (edited.status === "issued") {
      expect(editRace[0]?.status).toBe("fulfilled");
      expect(editRace[1]?.status).toBe("rejected");
      expect(edited.issuedIds).toHaveLength(1);
    } else {
      expect(edited.status).toBe("draft");
      expect(edited.revision).toBe(2);
      expect(editRace[0]?.status).toBe("rejected");
      expect(editRace[1]?.status).toBe("fulfilled");
    }

    const discardSet = await create("Issue versus discard");
    const discardGate = barrierAtEquityLedgerLock(f.prisma);
    const discardRace = await Promise.allSettled([
      f.as(f.mine, () =>
        issueEquityDraftSet(discardGate, f.mine, {
          id: discardSet.id,
          expectedRevision: discardSet.revision,
        }),
      ),
      f.as(f.mine, () =>
        updateEquityDraftSet(discardGate, f.mine, {
          id: discardSet.id,
          expectedRevision: discardSet.revision,
          status: "discarded",
        }),
      ),
    ]);
    expect(discardRace.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const discarded = await f.owner.equityDraftSet.findUniqueOrThrow({
      where: { id: discardSet.id },
    });
    expect(["issued", "discarded"]).toContain(discarded.status);
    if (discarded.status === "issued") {
      expect(discardRace[0]?.status).toBe("fulfilled");
      expect(discardRace[1]?.status).toBe("rejected");
    } else {
      expect(discardRace[0]?.status).toBe("rejected");
      expect(discardRace[1]?.status).toBe("fulfilled");
      expect(discarded.issuedIds).toEqual([]);
    }
  });

  it("reports aggregate same-class overflow before writing any certificate", async () => {
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Aggregate overflow",
        securityKind: "certificate",
        items: [share("6000000"), share("5000000")],
      }),
    );
    const review = await f.as(f.mine, () =>
      reviewEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
    );
    expect(review.ready).toBe(false);
    expect(review.totalShares).toBe("11000000");
    expect(review.items.every((item) => item.problems.includes("Exceeds authorized shares"))).toBe(
      true,
    );
    const before = await f.owner.equityCertificate.count({ where: f.mine });
    await expect(
      f.as(f.mine, () =>
        issueEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    expect(await f.owner.equityCertificate.count({ where: f.mine })).toBe(before);
  });

  it("checks only shares effective through each date against that date's authorization", async () => {
    const datedClass = await f.owner.equityShareClass.create({
      data: { ...f.mine, name: "Dated common", prefix: "DC", classType: "common" },
    });
    await f.owner.equityShareClassVersion.createMany({
      data: [
        {
          ...f.mine,
          shareClassId: datedClass.id,
          documentDate: new Date("2024-01-01T00:00:00Z"),
          authorizedShares: 5_000_000n,
        },
        {
          ...f.mine,
          shareClassId: datedClass.id,
          documentDate: new Date("2025-01-01T00:00:00Z"),
          authorizedShares: 10_000_000n,
        },
      ],
    });
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Dated authorization",
        securityKind: "certificate",
        items: [
          { ...share("1000000"), shareClassId: datedClass.id, issueDate: "2025-06-01" },
          { ...share("5000000"), shareClassId: datedClass.id, issueDate: "2024-06-01" },
        ],
      }),
    );
    const review = await f.as(f.mine, () =>
      reviewEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
    );
    expect(review.ready).toBe(true);
    expect(review.totalShares).toBe("6000000");
    const issued = await f.as(f.mine, () =>
      issueEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
    );
    expect(issued.issuedIds).toHaveLength(2);
    const issuedRows = await f.owner.equityCertificate.findMany({
      where: { id: { in: issued.issuedIds } },
      select: { id: true, quantity: true },
    });
    expect(
      issued.issuedIds.map((id) => issuedRows.find((row) => row.id === id)?.quantity.toString()),
    ).toEqual(["1000000", "5000000"]);
  });

  it("serializes review with edits and returns only a captured revision", async () => {
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Review edit serialization",
        securityKind: "certificate",
        items: [share("100")],
      }),
    );
    const certificatesBefore = await f.owner.equityCertificate.count({ where: f.mine });
    const transactionsBefore = await f.owner.equityTransaction.count({ where: f.mine });
    const synchronized = barrierAtEquityLedgerLock(f.prisma, 2);
    const [review, edit] = await Promise.allSettled([
      f.as(f.mine, () =>
        reviewEquityDraftSet(synchronized, f.mine, {
          id: set.id,
          expectedRevision: set.revision,
        }),
      ),
      f.as(f.mine, () =>
        updateEquityDraftSet(synchronized, f.mine, {
          id: set.id,
          expectedRevision: set.revision,
          name: "Edited after review",
        }),
      ),
    ]);
    expect(edit.status).toBe("fulfilled");
    if (review.status === "fulfilled") expect(review.value.revision).toBe(set.revision);
    else expect(review.reason).toBeInstanceOf(EquityConflictError);
    const after = await f.owner.equityDraftSet.findUniqueOrThrow({ where: { id: set.id } });
    expect(after.revision).toBe(set.revision + 1);
    expect(after.name).toBe("Edited after review");
    expect(after.status).toBe("draft");
    expect(await f.owner.equityCertificate.count({ where: f.mine })).toBe(certificatesBefore);
    expect(await f.owner.equityTransaction.count({ where: f.mine })).toBe(transactionsBefore);
  });

  it("rolls back earlier creations when a later certificate label conflicts", async () => {
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Duplicate label rollback",
        securityKind: "certificate",
        items: [
          { ...share("10"), label: "CS-9000001" },
          { ...share("20"), label: "CS-9000001" },
        ],
      }),
    );
    const certificatesBefore = await f.owner.equityCertificate.count({ where: f.mine });
    const issuesBefore = await f.owner.equityTransaction.count({
      where: { ...f.mine, kind: "issue", certificateId: { not: null } },
    });
    await expect(
      f.as(f.mine, () =>
        issueEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    expect(await f.owner.equityCertificate.count({ where: f.mine })).toBe(certificatesBefore);
    expect(
      await f.owner.equityTransaction.count({
        where: { ...f.mine, kind: "issue", certificateId: { not: null } },
      }),
    ).toBe(issuesBefore);
    expect(await f.owner.equityDraftSet.findUniqueOrThrow({ where: { id: set.id } })).toMatchObject(
      { status: "draft", issuedIds: [] },
    );
  });

  it("fails closed for legacy issued sets with no replay IDs", async () => {
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Legacy issued",
        securityKind: "certificate",
        items: [share("10")],
      }),
    );
    await f.owner.equityDraftSet.update({
      where: { id: set.id },
      data: { status: "issued", issuedAt: new Date(), issuedIds: [] },
    });
    await expect(
      f.as(f.mine, () =>
        issueEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("rejects stale review revisions", async () => {
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Stale review",
        securityKind: "certificate",
        items: [share("10")],
      }),
    );
    const updated = await f.as(f.mine, () =>
      updateEquityDraftSet(f.prisma, f.mine, {
        id: set.id,
        expectedRevision: set.revision,
        name: "Updated stale review",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        reviewEquityDraftSet(f.prisma, f.mine, {
          id: set.id,
          expectedRevision: set.revision,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    await expect(
      f.as(f.mine, () =>
        reviewEquityDraftSet(f.prisma, f.mine, {
          id: set.id,
          expectedRevision: updated.revision,
        }),
      ),
    ).resolves.toMatchObject({ revision: updated.revision, ready: true });
  });

  it("marks a certificate plan from another share class unready", async () => {
    const otherClass = await f.owner.equityShareClass.create({
      data: { ...f.mine, name: "Series A", prefix: "PA", classType: "preferred" },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        ...f.mine,
        shareClassId: otherClass.id,
        documentDate: new Date("2024-01-01T00:00:00Z"),
        authorizedShares: 10_000_000n,
      },
    });
    const plan = await f.owner.equityPlan.create({
      data: {
        ...f.mine,
        name: "Preferred plan",
        shareClassId: otherClass.id,
        reservedShares: 100n,
      },
    });
    const set = await f.as(f.mine, () =>
      createEquityDraftSet(f.prisma, f.mine, {
        name: "Mismatched plan",
        securityKind: "certificate",
        items: [{ ...share("10"), planId: plan.id }],
      }),
    );
    const review = await f.as(f.mine, () =>
      reviewEquityDraftSet(f.prisma, f.mine, { id: set.id, expectedRevision: set.revision }),
    );
    expect(review.ready).toBe(false);
    expect(review.items[0]?.problems).toContain("Plan share class mismatch");
  });
});
