import { EquityCertificateSchema, EquityConvertibleSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import {
  accruedInterest,
  createEquityCertificate,
  createEquityConvertible,
  createEquityConvertibleBlock,
  getEquityCertificate,
  getEquityConvertible,
  getEquityTransaction,
  interestUntil,
  listEquityCertificates,
  listEquityConvertibles,
  listEquityTransactions,
  updateEquityCertificate,
  updateEquityConvertible,
  updateEquityConvertibleBlock,
} from "./securities.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describeEquityPostgres("equity securities (PostgreSQL)", () => {
  let f: EquityFixture;
  let commonId = "";
  let preferredId = "";
  let adaId = "";
  let benId = "";

  beforeAll(async () => {
    f = await equityFixture("securities");
    const { mine } = f;
    adaId = (
      await f.as(mine, () =>
        createEquityStakeholder(f.prisma, mine, { type: "individual", name: "Ada Example" }),
      )
    ).id;
    benId = (
      await f.as(mine, () =>
        createEquityStakeholder(f.prisma, mine, { type: "individual", name: "Ben Sample" }),
      )
    ).id;
    const common = await f.owner.equityShareClass.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        name: "Common",
        prefix: "CS",
        classType: "common",
      },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        shareClassId: common.id,
        documentDate: day("2024-01-01"),
        authorizedShares: 1_000_000n,
      },
    });
    const preferred = await f.owner.equityShareClass.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        name: "Series A Preferred",
        prefix: "PS",
        classType: "preferred",
      },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        shareClassId: preferred.id,
        documentDate: day("2024-01-01"),
        authorizedShares: 100n,
      },
    });
    commonId = common.id;
    preferredId = preferred.id;
  });
  afterAll(async () => {
    await f?.close();
  });

  it("creates, reads, updates and lists certificates with their transactions", async () => {
    const { prisma, mine } = f;
    const created = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity: "1000",
        issueDate: "2024-02-01",
        cashPaidCents: "100",
        debtCanceledCents: "200",
        ipTransferredCents: "300",
        otherConsiderationCents: "400",
        pricePerShare: "1.25",
      }),
    );
    expect(EquityCertificateSchema.parse(created)).toEqual(created);
    expect(created.label).toBe("CS-1");
    expect(created.status).toBe("outstanding");
    expect(created.transactionValueCents).toBe("1000");
    expect(created.stakeholderName).toBe("Ada Example");
    expect(created.shareClassName).toBe("Common");

    const fetched = await f.as(mine, () => getEquityCertificate(prisma, mine, created.id));
    expect(fetched.id).toBe(created.id);

    const second = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: benId,
        shareClassId: preferredId,
        quantity: "50",
        issueDate: "2024-03-01",
        label: "PS-7",
        paperStatus: "paper",
      }),
    );
    expect(second.label).toBe("PS-7");

    const transactions = await f.as(mine, () => listEquityTransactions(prisma, mine, {}));
    expect(transactions.total).toBe(2);
    expect(transactions.items[0]!.kind).toBe("issue");
    expect(transactions.items.map((row) => row.securityLabel).sort()).toEqual(["CS-1", "PS-7"]);
    expect(transactions.items[0]!.quantity).toBe("50");

    const updated = await f.as(mine, () =>
      updateEquityCertificate(prisma, mine, {
        id: created.id,
        adminNotes: "Reviewed metadata",
        reason: "amendment",
        note: "Metadata reviewed",
      }),
    );
    expect(updated.status).toBe("outstanding");
    expect(updated.adminNotes).toBe("Reviewed metadata");

    const history = await f.as(mine, () =>
      listEquityTransactions(prisma, mine, { certificateId: created.id }),
    );
    expect(history.items.map((row) => row.kind)).toEqual(["modify", "issue"]);
    const modify = history.items[0]!;
    expect(modify.reason).toBe("amendment");
    expect(modify.note).toBe("Metadata reviewed");
    expect((modify.before as { status: string }).status).toBe("outstanding");
    expect((modify.after as { status: string }).status).toBe("outstanding");
    const one = await f.as(mine, () => getEquityTransaction(prisma, mine, modify.id));
    expect(one.securityLabel).toBe("CS-1");

    // Filters, sorting and pages.
    const byStakeholder = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { stakeholderId: benId }),
    );
    expect(byStakeholder.items.map((row) => row.label)).toEqual(["PS-7"]);
    const byStatus = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { status: ["outstanding"] }),
    );
    expect(byStatus.items.map((row) => row.label)).toEqual(["CS-1", "PS-7"]);
    const canceledRange = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, {
        canceledFrom: "2024-12-01",
        canceledTo: "2025-02-01",
      }),
    );
    expect(canceledRange.total).toBe(0);
    const issuedRange = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { issuedFrom: "2024-02-15" }),
    );
    expect(issuedRange.items.map((row) => row.label)).toEqual(["PS-7"]);
    const byClass = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { shareClassId: [commonId] }),
    );
    expect(byClass.items.map((row) => row.label)).toEqual(["CS-1"]);
    const byPaper = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { paperStatus: "paper" }),
    );
    expect(byPaper.items.map((row) => row.label)).toEqual(["PS-7"]);
    const byAcceptance = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { acceptanceStatus: ["accepted"] }),
    );
    expect(byAcceptance.total).toBe(2);
    const search = await f.as(mine, () => listEquityCertificates(prisma, mine, { search: "ada" }));
    expect(search.items.map((row) => row.label)).toEqual(["CS-1"]);
    const page = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, {
        sort: { field: "stakeholderName", dir: "desc" },
        pageSize: 1,
      }),
    );
    expect(page.total).toBe(2);
    expect(page.items.map((row) => row.stakeholderName)).toEqual(["Ben Sample"]);
    const priced = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { sort: { field: "pricePerShare", dir: "desc" } }),
    );
    expect(priced.items.map((row) => row.label)).toEqual(["CS-1", "PS-7"]);
    const byQuantity = await f.as(mine, () =>
      listEquityCertificates(prisma, mine, { sort: { field: "quantity", dir: "desc" } }),
    );
    expect(byQuantity.items.map((row) => row.label)).toEqual(["CS-1", "PS-7"]);
  });

  it("refuses bad references, over-issue and duplicate labels", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId: "missing",
          shareClassId: commonId,
          quantity: "1",
          issueDate: "2024-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId: adaId,
          shareClassId: preferredId,
          quantity: "51",
          issueDate: "2024-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId: adaId,
          shareClassId: commonId,
          quantity: "1",
          issueDate: "2024-01-01",
          label: "PS-99",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId: adaId,
          shareClassId: commonId,
          quantity: "1",
          issueDate: "2024-01-01",
          label: "CS-1",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("persists certificate label changes and rejects invalid or duplicate labels", async () => {
    const { prisma, mine } = f;
    const first = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity: "1",
        issueDate: "2024-03-01",
        label: "CS-900001",
      }),
    );
    const second = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: benId,
        shareClassId: commonId,
        quantity: "1",
        issueDate: "2024-03-01",
        label: "CS-900002",
      }),
    );

    const renamed = await f.as(mine, () =>
      updateEquityCertificate(prisma, mine, { id: first.id, label: "CS-900003" }),
    );
    expect(renamed.label).toBe("CS-900003");
    await expect(
      f.as(mine, () => updateEquityCertificate(prisma, mine, { id: first.id, label: "PA-900004" })),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, { id: second.id, label: "CS-900003" }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("rejects forged certificate lineage, terminal creation and plan/class mismatches", async () => {
    const { prisma, mine } = f;
    const source = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity: "1",
        issueDate: "2024-03-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId: benId,
          shareClassId: commonId,
          quantity: "1",
          issueDate: "2024-03-01",
          parentId: source.id,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId: benId,
          shareClassId: commonId,
          quantity: "1",
          issueDate: "2024-03-01",
          status: "canceled",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, { id: source.id, parentId: source.id }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const plan = await f.owner.equityPlan.create({
      data: {
        ...mine,
        name: "Common share plan",
        shareClassId: commonId,
        reservedShares: 100n,
      },
    });
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId: benId,
          shareClassId: preferredId,
          planId: plan.id,
          quantity: "1",
          issueDate: "2024-03-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("handles convertible blocks and convertibles with interest", async () => {
    const { prisma, mine } = f;
    const block = await f.as(mine, () =>
      createEquityConvertibleBlock(prisma, mine, { name: "Seed SAFEs", kind: "safe" }),
    );
    await expect(
      f.as(mine, () =>
        createEquityConvertibleBlock(prisma, mine, { name: "Seed SAFEs", kind: "safe" }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const renamed = await f.as(mine, () =>
      updateEquityConvertibleBlock(prisma, mine, { id: block.id, name: "Seed SAFE round" }),
    );
    expect(renamed.name).toBe("Seed SAFE round");

    const safe = await f.as(mine, () =>
      createEquityConvertible(prisma, mine, {
        stakeholderId: adaId,
        blockId: block.id,
        kind: "safe",
        principalCents: "50000000",
        issueDate: "2024-01-01",
      }),
    );
    expect(EquityConvertibleSchema.parse(safe)).toEqual(safe);
    expect(safe.label).toBe("SAFE-1");
    expect(safe.blockName).toBe("Seed SAFE round");
    expect(safe.interestAccruedCents).toBe("0");
    expect(safe.totalCents).toBe("50000000");

    const note = await f.as(mine, () =>
      createEquityConvertible(prisma, mine, {
        stakeholderId: benId,
        kind: "note",
        principalCents: "100000",
        issueDate: "2024-01-01",
        interestRate: "10",
        interestStartDate: "2024-01-01",
        interestType: "simple",
        dayCountConvention: "actual_365",
        maturityDate: "2024-06-01",
      }),
    );
    expect(note.label).toBe("CN-1");
    // 10% simple interest over today's elapsed days is greater than zero and below the cap.
    expect(note.interestAccruedCents).not.toBeNull();
    expect(note.totalCents).not.toBeNull();
    expect(BigInt(note.interestAccruedCents!)).toBeGreaterThan(0n);
    expect(BigInt(note.totalCents!)).toBe(
      BigInt(note.principalCents) + BigInt(note.interestAccruedCents!),
    );

    const fetched = await f.as(mine, () => getEquityConvertible(prisma, mine, note.id));
    expect(fetched.id).toBe(note.id);

    const byKind = await f.as(mine, () => listEquityConvertibles(prisma, mine, { kind: "note" }));
    expect(byKind.items.map((row) => row.label)).toEqual(["CN-1"]);
    const byBlock = await f.as(mine, () =>
      listEquityConvertibles(prisma, mine, { blockId: [block.id] }),
    );
    expect(byBlock.items.map((row) => row.label)).toEqual(["SAFE-1"]);
    const byStatus = await f.as(mine, () =>
      listEquityConvertibles(prisma, mine, { status: ["outstanding"] }),
    );
    expect(byStatus.total).toBe(2);
    const issued = await f.as(mine, () =>
      listEquityConvertibles(prisma, mine, { issuedFrom: "2024-02-01" }),
    );
    expect(issued.total).toBe(0);
    const sorted = await f.as(mine, () =>
      listEquityConvertibles(prisma, mine, { sort: { field: "principalCents", dir: "desc" } }),
    );
    expect(sorted.items.map((row) => row.label)).toEqual(["SAFE-1", "CN-1"]);
    const searched = await f.as(mine, () =>
      listEquityConvertibles(prisma, mine, { search: "ben" }),
    );
    expect(searched.items.map((row) => row.label)).toEqual(["CN-1"]);

    const updated = await f.as(mine, () =>
      updateEquityConvertible(prisma, mine, {
        id: note.id,
        status: "repaid",
        closedOn: "2024-12-31",
      }),
    );
    expect(updated).toMatchObject({
      status: "repaid",
      closedOn: "2024-12-31",
      interestAccruedCents: "10000",
      totalCents: "110000",
    });
    const history = await f.as(mine, () =>
      listEquityTransactions(prisma, mine, { convertibleId: note.id }),
    );
    expect(history.items.map((row) => row.kind)).toEqual(["modify", "issue"]);
    expect(history.items[0]!.securityLabel).toBe("CN-1");
    expect(history.items[0]!.effectiveDate).toBe("2024-12-31");
    expect(history.items[0]!.after).toMatchObject({ closedOn: "2024-12-31" });
    expect(history.items[0]!.before).toMatchObject({ status: "outstanding", closedOn: null });
    expect(history.items[0]!.after).toMatchObject({ status: "repaid", closedOn: "2024-12-31" });
    const edited = await f.as(mine, () =>
      updateEquityConvertible(prisma, mine, {
        id: note.id,
        label: "CN-99",
        adminNotes: "Reconciled",
      }),
    );
    expect(edited.label).toBe("CN-99");
    expect(edited.interestAccruedCents).toBe(updated.interestAccruedCents);

    const unrepaid = await f.as(mine, () =>
      createEquityConvertible(prisma, mine, {
        stakeholderId: adaId,
        kind: "note",
        principalCents: "10000",
        issueDate: "2024-01-01",
        interestRate: "10",
        interestStartDate: "2024-01-01",
        interestType: "simple",
        dayCountConvention: "actual_365",
      }),
    );
    await expect(
      f.as(mine, () =>
        updateEquityConvertible(prisma, mine, { id: unrepaid.id, status: "repaid" }),
      ),
    ).rejects.toThrow();
    expect((await f.as(mine, () => getEquityConvertible(prisma, mine, unrepaid.id))).status).toBe(
      "outstanding",
    );
    expect(
      (
        await f.as(mine, () => listEquityTransactions(prisma, mine, { convertibleId: unrepaid.id }))
      ).items.map((item) => item.kind),
    ).toEqual(["issue"]);

    await expect(
      f.as(mine, () =>
        createEquityConvertible(prisma, mine, {
          stakeholderId: adaId,
          kind: "safe",
          principalCents: "1",
          issueDate: "2024-01-01",
          blockId: "missing",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("computes interest with every day count, rounded half up", () => {
    expect(
      accruedInterest(500_000n, "10", "2024-01-01", "2024-12-31", "simple", "actual_365"),
    ).toBe(50_000n);
    expect(
      accruedInterest(500_000n, "10", "2024-01-01", "2025-01-01", "simple", "actual_365"),
    ).toBe(50_137n);
    expect(
      accruedInterest(500_000n, "10", "2024-01-01", "2025-01-01", "simple", "actual_360"),
    ).toBe(50_833n);
    expect(accruedInterest(500_000n, "10", "2024-01-01", "2025-01-01", "simple", "30_360")).toBe(
      50_000n,
    );
    expect(
      accruedInterest(100_000n, "10", "2024-01-01", "2026-01-01", "compound", "actual_365"),
    ).toBe(21_000n); // two calendar-year periods: 100,000 * 1.1^2
    expect(
      accruedInterest(100_000n, null, "2024-01-01", "2025-01-01", "simple", "actual_365"),
    ).toBe(0n);
    expect(accruedInterest(100_000n, "10", null, "2025-01-01", "simple", "actual_365")).toBe(0n);
  });

  it("uses only the explicit closure date and caps interest at the as-of date", () => {
    const row = {
      status: "repaid",
      closedOn: day("2024-12-31"),
      canceledOn: null,
      maturityDate: null,
      updatedAt: day("2024-01-01"),
    };
    expect(interestUntil(row, "2024-06-01")).toBe("2024-06-01");
    expect(interestUntil({ ...row, closedOn: null }, "2024-06-01")).toBeNull();
    expect(interestUntil({ ...row, status: "outstanding", closedOn: null }, "2024-06-01")).toBe(
      "2024-06-01",
    );
  });

  it("does not allow creating an outstanding note with a closure date", async () => {
    for (const closedOn of ["2024-02-01", null]) {
      await expect(
        f.as(f.mine, () =>
          createEquityConvertible(f.prisma, f.mine, {
            stakeholderId: adaId,
            kind: "note",
            principalCents: "100000",
            issueDate: "2024-01-01",
            closedOn,
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    }
  });

  it("requires a valid explicit repayment date and leaves invalid attempts untouched", async () => {
    const makeNote = () =>
      f.as(f.mine, () =>
        createEquityConvertible(f.prisma, f.mine, {
          stakeholderId: adaId,
          kind: "note",
          principalCents: "100000",
          issueDate: "2024-01-01",
        }),
      );
    const missingDate = await makeNote();
    const beforeIssue = await makeNote();
    const results = await Promise.allSettled([
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, { id: missingDate.id, status: "repaid" }),
      ),
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, {
          id: beforeIssue.id,
          status: "repaid",
          closedOn: "2023-12-31",
        }),
      ),
    ]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    for (const row of [missingDate, beforeIssue]) {
      expect(
        (await f.as(f.mine, () => getEquityConvertible(f.prisma, f.mine, row.id))).status,
      ).toBe("outstanding");
      expect(
        (
          await f.as(f.mine, () =>
            listEquityTransactions(f.prisma, f.mine, { convertibleId: row.id }),
          )
        ).items.map((transaction) => transaction.kind),
      ).toEqual(["issue"]);
    }
  });

  it("rejects repayment updates that change note terms", async () => {
    const makeNote = () =>
      f.as(f.mine, () =>
        createEquityConvertible(f.prisma, f.mine, {
          stakeholderId: adaId,
          kind: "note",
          principalCents: "100000",
          issueDate: "2024-01-01",
        }),
      );
    const [dateNote, kindNote] = await Promise.all([makeNote(), makeNote()]);
    const results = await Promise.allSettled([
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, {
          id: dateNote.id,
          status: "repaid",
          closedOn: "2024-12-31",
          issueDate: "2025-01-01",
        }),
      ),
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, {
          id: kindNote.id,
          status: "repaid",
          closedOn: "2024-12-31",
          kind: "safe",
        }),
      ),
    ]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    for (const row of [dateNote, kindNote]) {
      expect(
        await f.as(f.mine, () => getEquityConvertible(f.prisma, f.mine, row.id)),
      ).toMatchObject({ status: "outstanding", kind: "note", issueDate: "2024-01-01" });
      expect(
        (
          await f.as(f.mine, () =>
            listEquityTransactions(f.prisma, f.mine, { convertibleId: row.id }),
          )
        ).items.map((transaction) => transaction.kind),
      ).toEqual(["issue"]);
    }
  });

  it("returns legacy closed notes as unavailable and supports one audited closure repair", async () => {
    const note = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "note",
        principalCents: "100000",
        issueDate: "2024-01-01",
        interestRate: "10",
        interestStartDate: "2024-01-01",
        interestType: "simple",
        dayCountConvention: "actual_365",
      }),
    );
    await f.owner.equityConvertible.update({
      where: { id: note.id },
      data: { status: "repaid" },
    });
    const legacy = await f.as(f.mine, () => getEquityConvertible(f.prisma, f.mine, note.id));
    expect(legacy).toMatchObject({
      closedOn: null,
      interestAccruedCents: null,
      totalCents: null,
    });
    const repaired = await f.as(f.mine, () =>
      updateEquityConvertible(f.prisma, f.mine, {
        id: note.id,
        closedOn: "2024-12-31",
        reason: "clerical_error",
      }),
    );
    expect(repaired).toMatchObject({ closedOn: "2024-12-31", interestAccruedCents: "10000" });
    const history = await f.as(f.mine, () =>
      listEquityTransactions(f.prisma, f.mine, { convertibleId: note.id }),
    );
    expect(history.items[0]!.effectiveDate).toBe("2024-12-31");
    expect(history.items[0]!.before).toMatchObject({ closedOn: null, totalCents: null });
    expect(history.items[0]!.after).toMatchObject({ closedOn: "2024-12-31", totalCents: "110000" });
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, { id: note.id, closedOn: "2025-01-01" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, { id: note.id, closedOn: null }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.otherSpace, () =>
        updateEquityConvertible(f.prisma, f.otherSpace, {
          id: note.id,
          closedOn: "2024-12-31",
        }),
      ),
    ).rejects.toThrow();
  });

  it("keeps another user's and another space's ledger apart", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const [certificate] = (
      await f.as(mine, () => listEquityCertificates(prisma, mine, { search: "ada" }))
    ).items;
    const [convertible] = (await f.as(mine, () => listEquityConvertibles(prisma, mine, {}))).items;
    for (const other of [sameSpace, otherSpace]) {
      expect((await f.as(other, () => listEquityCertificates(prisma, other, {}))).total).toBe(0);
      expect((await f.as(other, () => listEquityConvertibles(prisma, other, {}))).total).toBe(0);
      expect((await f.as(other, () => listEquityTransactions(prisma, other, {}))).total).toBe(0);
      await expect(
        f.as(other, () => getEquityCertificate(prisma, other, certificate!.id)),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(other, () => getEquityConvertible(prisma, other, convertible!.id)),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(other, () =>
          updateEquityCertificate(prisma, other, { id: certificate!.id, quantity: "1" }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      // A reference to someone else's row is refused.
      await expect(
        f.as(other, () =>
          createEquityCertificate(prisma, other, {
            stakeholderId: adaId,
            shareClassId: commonId,
            quantity: "1",
            issueDate: "2024-01-01",
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    }
  });
});
