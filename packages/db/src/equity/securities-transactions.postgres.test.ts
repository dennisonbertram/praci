import { EquityShareTransactionResultSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "../client.js";
import { IsolationError } from "../scope.js";
import type { EquityScope } from "./ledger.js";
import { EquityInputError } from "./ledger.js";
import {
  createEquityCertificate,
  getEquityCertificate,
  updateEquityCertificate,
} from "./securities.js";
import {
  cancelEquityCertificate,
  convertEquityCertificate,
  equityCertificateTotals,
  repurchaseEquityCertificate,
  transferEquityCertificate,
} from "./securities-transactions.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function barrierBeforeUnprotectedRead(
  prisma: PrismaClient,
  delegateName: "equityCertificate",
  methodName: "findFirst" | "findMany" | "aggregate",
  protection: "row-lock" | "label-lock",
  matches: (args: unknown) => boolean,
): PrismaClient {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const arrive = async () => {
    arrived += 1;
    if (arrived === 2) release();
    await gate;
  };

  const wrapTransaction = (transaction: object) => {
    let protectedRead = false;
    return new Proxy(transaction, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (
          typeof property === "string" &&
          ["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"].includes(property) &&
          typeof value === "function"
        ) {
          return (...args: unknown[]) => {
            const query = String(args[0] ?? "");
            if (
              (protection === "row-lock" && query.includes("FOR UPDATE")) ||
              (protection === "label-lock" && query.includes("pg_advisory_xact_lock"))
            )
              protectedRead = true;
            return Reflect.apply(value, target, args);
          };
        }
        if (property !== delegateName || value === null || typeof value !== "object") return value;
        return new Proxy(value, {
          get(delegate, method, delegateReceiver) {
            const operation = Reflect.get(delegate, method, delegateReceiver);
            if (method !== methodName || typeof operation !== "function") return operation;
            return async (...args: unknown[]) => {
              const result = await Reflect.apply(operation, delegate, args);
              if (!protectedRead && matches(args[0])) await arrive();
              return result;
            };
          },
        });
      },
    });
  };

  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      const transaction = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const callback = args[0];
        if (typeof callback !== "function") return Reflect.apply(transaction, target, args);
        return Reflect.apply(transaction, target, [
          (tx: object) => Reflect.apply(callback, undefined, [wrapTransaction(tx)]),
          ...args.slice(1),
        ]);
      };
    },
  });
}

const hasCertificateId = (id: string) => (raw: unknown) => {
  if (raw === null || typeof raw !== "object") return false;
  const where = (raw as { where?: { id?: unknown } }).where;
  return where?.id === id;
};

const hasAutomaticLabelPrefix = (raw: unknown) => {
  if (raw === null || typeof raw !== "object") return false;
  const where = (raw as { where?: { label?: { startsWith?: unknown } } }).where;
  return typeof where?.label?.startsWith === "string";
};

function pauseUnprotectedRead(
  prisma: PrismaClient,
  delegateName: "equityCertificate",
  methodName: "findFirst",
  matches: (args: unknown) => boolean,
): { prisma: PrismaClient; entered: Promise<void>; release: () => void } {
  let notifyEntered!: () => void;
  let releaseRead!: () => void;
  let paused = false;
  const entered = new Promise<void>((resolve) => {
    notifyEntered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  const wrapTransaction = (transaction: object) => {
    let protectedRead = false;
    return new Proxy(transaction, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (
          typeof property === "string" &&
          ["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"].includes(property) &&
          typeof value === "function"
        ) {
          return (...args: unknown[]) => {
            if (String(args[0] ?? "").includes("FOR UPDATE")) protectedRead = true;
            return Reflect.apply(value, target, args);
          };
        }
        if (property !== delegateName || value === null || typeof value !== "object") return value;
        return new Proxy(value, {
          get(delegate, method, delegateReceiver) {
            const operation = Reflect.get(delegate, method, delegateReceiver);
            if (method !== methodName || typeof operation !== "function") return operation;
            return async (...args: unknown[]) => {
              const result = await Reflect.apply(operation, delegate, args);
              if (!protectedRead && !paused && matches(args[0])) {
                paused = true;
                notifyEntered();
                await gate;
              }
              return result;
            };
          },
        });
      },
    });
  };
  const wrapped = new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      const transaction = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const callback = args[0];
        if (typeof callback !== "function") return Reflect.apply(transaction, target, args);
        return Reflect.apply(transaction, target, [
          (tx: object) => Reflect.apply(callback, undefined, [wrapTransaction(tx)]),
          ...args.slice(1),
        ]);
      };
    },
  });
  return { prisma: wrapped, entered, release: releaseRead };
}

describeEquityPostgres("equity share transactions (PostgreSQL)", () => {
  let f: EquityFixture;
  let commonId = "";
  let preferredId = "";
  let adaId = "";
  let benId = "";

  async function shareClass(
    scope: EquityScope,
    name: string,
    prefix: string,
    authorizedShares = 10_000_000n,
    documentDate = "2024-01-01",
  ) {
    const row = await f.owner.equityShareClass.create({
      data: { ...scope, name, prefix, classType: prefix === "CS" ? "common" : "preferred" },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: row.id,
        documentDate: day(documentDate),
        authorizedShares,
      },
    });
    return row.id;
  }

  const issue = (quantity: string) =>
    f.as(f.mine, () =>
      createEquityCertificate(f.prisma, f.mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity,
        issueDate: "2024-02-01",
      }),
    );

  beforeAll(async () => {
    f = await equityFixture("share-transactions");
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
    commonId = await shareClass(mine, "Common", "CS");
    preferredId = await shareClass(mine, "Series A Preferred", "PA");
  });

  afterAll(async () => {
    await f?.close();
  });

  it("transfers a whole certificate to another stakeholder", async () => {
    const source = await issue("1000");
    const result = await f.as(f.mine, () =>
      transferEquityCertificate(f.prisma, f.mine, {
        certificateId: source.id,
        toStakeholderId: benId,
        quantity: "1000",
        effectiveDate: "2024-03-01",
        reason: "secondary",
        pricePerShare: "1.25",
      }),
    );
    expect(() => EquityShareTransactionResultSchema.parse(result)).not.toThrow();
    expect(result.resulting).toHaveLength(1);
    expect(result.resulting[0]).toMatchObject({
      stakeholderId: benId,
      quantity: "1000",
      parentId: source.id,
    });
    const closed = await f.as(f.mine, () => getEquityCertificate(f.prisma, f.mine, source.id));
    expect(closed.status).toBe("transferred");
    const row = await f.owner.equityTransaction.findUniqueOrThrow({
      where: { id: result.transactionId },
    });
    expect(row).toMatchObject({ kind: "transfer", quantity: 1000n, valueCents: 125_000n });
    expect(row.resulting).toEqual([result.resulting[0]!.id]);
  });

  it("leaves a remainder on a partial transfer, repurchase and cancel", async () => {
    for (const run of [
      (id: string) =>
        transferEquityCertificate(f.prisma, f.mine, {
          certificateId: id,
          toStakeholderId: benId,
          quantity: "300",
          effectiveDate: "2024-03-01",
          reason: "gift",
        }),
      (id: string) =>
        repurchaseEquityCertificate(f.prisma, f.mine, {
          certificateId: id,
          quantity: "300",
          effectiveDate: "2024-03-01",
          reason: "buyback",
        }),
      (id: string) =>
        cancelEquityCertificate(f.prisma, f.mine, {
          certificateId: id,
          quantity: "300",
          effectiveDate: "2024-03-01",
          reason: "write_off_cancel",
        }),
    ]) {
      const source = await issue("1000");
      const result = await f.as(f.mine, () => run(source.id));
      const remainder = result.resulting.find((row) => row.stakeholderId === adaId);
      expect(remainder).toMatchObject({ quantity: "700", status: "outstanding" });
    }
  });

  it("clones vesting terms for a partial-transfer remainder", async () => {
    const schedule = await f.owner.equityVestingSchedule.create({
      data: {
        ...f.mine,
        startDate: new Date("2024-02-01T00:00:00.000Z"),
        totalMonths: 48,
        cliffMonths: 12,
        frequencyMonths: 1,
        acceleratedShares: 400n,
        acceleratedOn: new Date("2024-02-01T00:00:00.000Z"),
      },
    });
    const source = await f.as(f.mine, () =>
      createEquityCertificate(f.prisma, f.mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity: "1000",
        issueDate: "2024-02-01",
        vestingScheduleId: schedule.id,
      }),
    );
    const result = await f.as(f.mine, () =>
      transferEquityCertificate(f.prisma, f.mine, {
        certificateId: source.id,
        toStakeholderId: benId,
        quantity: "300",
        effectiveDate: "2024-03-01",
        reason: "gift",
      }),
    );
    const remainder = result.resulting.find((row) => row.stakeholderId === adaId)!;
    expect(remainder).toMatchObject({ quantity: "700", status: "outstanding" });
    expect(remainder.vestingScheduleId).toBeTruthy();
    expect(remainder.vestingScheduleId).not.toBe(source.vestingScheduleId);
    const copiedSchedule = await f.owner.equityVestingSchedule.findUniqueOrThrow({
      where: { id: remainder.vestingScheduleId! },
    });
    expect(copiedSchedule).toMatchObject({
      totalMonths: 48,
      cliffMonths: 12,
      acceleratedShares: 280n,
    });
    expect(source.vestingScheduleId).toBe(schedule.id);
    await expect(
      f.owner.equityVestingSchedule.findUniqueOrThrow({ where: { id: schedule.id } }),
    ).resolves.toMatchObject({ totalMonths: 48, cliffMonths: 12, acceleratedShares: 400n });
  });

  it("serializes concurrent dispositions of one certificate", async () => {
    const source = await issue("100");
    const unlockedReadBarrier = barrierBeforeUnprotectedRead(
      f.prisma,
      "equityCertificate",
      "findFirst",
      "row-lock",
      hasCertificateId(source.id),
    );
    const outcomes = await Promise.allSettled([
      f.as(f.mine, () =>
        cancelEquityCertificate(unlockedReadBarrier, f.mine, {
          certificateId: source.id,
          quantity: "100",
          effectiveDate: "2024-03-01",
          reason: "write_off_cancel",
        }),
      ),
      f.as(f.mine, () =>
        repurchaseEquityCertificate(unlockedReadBarrier, f.mine, {
          certificateId: source.id,
          quantity: "100",
          effectiveDate: "2024-03-01",
          reason: "buyback",
        }),
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(
      outcomes
        .filter((outcome) => outcome.status === "rejected")
        .every((outcome) => outcome.reason instanceof EquityInputError),
    ).toBe(true);
    const rows = await f.owner.equityTransaction.findMany({
      where: { ...f.mine, certificateId: source.id },
    });
    expect(rows.filter((row) => ["cancel", "repurchase"].includes(row.kind))).toHaveLength(1);
  });

  it("issues unrelated certificates concurrently with unique automatic labels", async () => {
    const concurrentDb = barrierBeforeUnprotectedRead(
      f.prisma,
      "equityCertificate",
      "findMany",
      "label-lock",
      hasAutomaticLabelPrefix,
    );
    const created = await Promise.all(
      [
        { stakeholderId: adaId, quantity: "31" },
        { stakeholderId: benId, quantity: "47" },
      ].map(({ stakeholderId, quantity }) =>
        f.as(f.mine, () =>
          createEquityCertificate(concurrentDb, f.mine, {
            stakeholderId,
            shareClassId: commonId,
            quantity,
            issueDate: "2024-03-02",
          }),
        ),
      ),
    );
    expect(created).toHaveLength(2);
    expect(new Set(created.map((row) => row.label)).size).toBe(2);
  });

  it("converts a certificate into another class at a ratio", async () => {
    const source = await issue("1000");
    const result = await f.as(f.mine, () =>
      convertEquityCertificate(f.prisma, f.mine, {
        certificateId: source.id,
        toShareClassId: preferredId,
        ratio: "0.5",
        effectiveDate: "2024-04-01",
      }),
    );
    expect(result.resulting[0]).toMatchObject({ shareClassId: preferredId, quantity: "500" });
    expect(result.resulting[0]!.label).toMatch(/^PA-/);
    const closed = await f.as(f.mine, () => getEquityCertificate(f.prisma, f.mine, source.id));
    expect(closed.status).toBe("converted");
  });

  it("rejects fractional conversion output and enforces target class authorization by effective date", async () => {
    const fractional = await issue("1001");
    await expect(
      f.as(f.mine, () =>
        convertEquityCertificate(f.prisma, f.mine, {
          certificateId: fractional.id,
          toShareClassId: preferredId,
          ratio: "0.5",
          effectiveDate: "2024-04-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () => getEquityCertificate(f.prisma, f.mine, fractional.id)),
    ).resolves.toMatchObject({ status: "outstanding" });

    const limitedId = await shareClass(f.mine, "Limited Target", "LT", 100n);
    await f.as(f.mine, () =>
      createEquityCertificate(f.prisma, f.mine, {
        stakeholderId: benId,
        shareClassId: limitedId,
        quantity: "100",
        issueDate: "2024-02-01",
      }),
    );
    const overCapacity = await issue("1");
    await expect(
      f.as(f.mine, () =>
        convertEquityCertificate(f.prisma, f.mine, {
          certificateId: overCapacity.id,
          toShareClassId: limitedId,
          ratio: "1",
          effectiveDate: "2024-03-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const futureClassId = await shareClass(
      f.mine,
      "Future Authorized Class",
      "FA",
      100n,
      "2024-05-01",
    );
    const beforeAuthorization = await issue("1");
    await expect(
      f.as(f.mine, () =>
        convertEquityCertificate(f.prisma, f.mine, {
          certificateId: beforeAuthorization.id,
          toShareClassId: futureClassId,
          ratio: "1",
          effectiveDate: "2024-04-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("does not discard a plan when converting to a mismatched share class", async () => {
    const plan = await f.owner.equityPlan.create({
      data: {
        ...f.mine,
        name: "Conversion provenance plan",
        shareClassId: commonId,
        reservedShares: 1000n,
      },
    });
    const source = await f.as(f.mine, () =>
      createEquityCertificate(f.prisma, f.mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        planId: plan.id,
        quantity: "100",
        issueDate: "2024-02-01",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        convertEquityCertificate(f.prisma, f.mine, {
          certificateId: source.id,
          toShareClassId: preferredId,
          ratio: "1",
          effectiveDate: "2024-04-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () => getEquityCertificate(f.prisma, f.mine, source.id)),
    ).resolves.toMatchObject({ status: "outstanding", planId: plan.id });
  });

  it("serializes concurrent certificate capacity changes", async () => {
    const limitedClassId = await shareClass(f.mine, "Racing Capacity", "RC", 100n);
    const certificates = await Promise.all(
      [adaId, benId].map((stakeholderId) =>
        f.as(f.mine, () =>
          createEquityCertificate(f.prisma, f.mine, {
            stakeholderId,
            shareClassId: limitedClassId,
            quantity: "40",
            issueDate: "2024-02-01",
          }),
        ),
      ),
    );
    const interleaved = barrierBeforeUnprotectedRead(
      f.prisma,
      "equityCertificate",
      "aggregate",
      "row-lock",
      (raw) =>
        raw !== null &&
        typeof raw === "object" &&
        (raw as { where?: { shareClassId?: string } }).where?.shareClassId === limitedClassId,
    );
    const outcomes = await Promise.allSettled(
      certificates.map((certificate) =>
        f.as(f.mine, () =>
          updateEquityCertificate(interleaved, f.mine, {
            id: certificate.id,
            quantity: "60",
          }),
        ),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(
      outcomes
        .filter((outcome) => outcome.status === "rejected")
        .every((outcome) => outcome.reason instanceof EquityInputError),
    ).toBe(true);
    const total = await f.owner.equityCertificate.aggregate({
      where: { ...f.mine, shareClassId: limitedClassId },
      _sum: { quantity: true },
    });
    expect(total._sum.quantity).toBe(100n);
  });

  it("does not let a raced generic update reopen a disposed certificate", async () => {
    const source = await issue("100");
    const paused = pauseUnprotectedRead(
      f.prisma,
      "equityCertificate",
      "findFirst",
      hasCertificateId(source.id),
    );
    const update = f.as(f.mine, () =>
      updateEquityCertificate(paused.prisma, f.mine, {
        id: source.id,
        status: "outstanding",
        adminNotes: "interleaved metadata edit",
      }),
    );
    const updatePaused = await Promise.race([
      paused.entered.then(() => true),
      update.then(() => false),
    ]);
    const disposition = f.as(f.mine, () =>
      transferEquityCertificate(f.prisma, f.mine, {
        certificateId: source.id,
        toStakeholderId: benId,
        quantity: "100",
        effectiveDate: "2024-03-01",
        reason: "gift",
      }),
    );
    const transferred = await disposition;
    if (updatePaused) paused.release();
    await update;

    const after = await f.as(f.mine, () => getEquityCertificate(f.prisma, f.mine, source.id));
    expect(after.status).toBe("transferred");
    const active = await f.owner.equityCertificate.aggregate({
      where: {
        ...f.mine,
        id: { in: [source.id, ...transferred.resulting.map((row) => row.id)] },
        status: "outstanding",
      },
      _sum: { quantity: true },
    });
    expect(active._sum.quantity).toBe(100n);
  });

  it("routes lifecycle changes through dispositions and audits metadata-only edits after consumption", async () => {
    const source = await issue("100");
    await expect(
      f.as(f.mine, () =>
        updateEquityCertificate(f.prisma, f.mine, {
          id: source.id,
          status: "canceled",
          canceledOn: "2024-03-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await f.as(f.mine, () =>
      cancelEquityCertificate(f.prisma, f.mine, {
        certificateId: source.id,
        quantity: "100",
        effectiveDate: "2024-03-01",
        reason: "write_off_cancel",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        updateEquityCertificate(f.prisma, f.mine, { id: source.id, status: "outstanding" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () =>
        updateEquityCertificate(f.prisma, f.mine, { id: source.id, quantity: "99" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const edited = await f.as(f.mine, () =>
      updateEquityCertificate(f.prisma, f.mine, {
        id: source.id,
        adminNotes: "Metadata only",
        note: "Audit note",
      }),
    );
    expect(edited).toMatchObject({ status: "canceled", adminNotes: "Metadata only" });
    const event = await f.owner.equityTransaction.findFirstOrThrow({
      where: { ...f.mine, certificateId: source.id, kind: "modify" },
      orderBy: { createdAt: "desc" },
    });
    expect(event.before).toMatchObject({ status: "canceled", quantity: "100" });
    expect(event.after).toMatchObject({ status: "canceled", adminNotes: "Metadata only" });
  });

  it("allocates disposed basis by floor and records all resulting certificates", async () => {
    const source = await f.as(f.mine, () =>
      createEquityCertificate(f.prisma, f.mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity: "100",
        costBasisCents: "10003",
        issueDate: "2024-02-01",
      }),
    );
    const transfer = await f.as(f.mine, () =>
      transferEquityCertificate(f.prisma, f.mine, {
        certificateId: source.id,
        toStakeholderId: benId,
        quantity: "40",
        effectiveDate: "2024-03-01",
        reason: "gift",
      }),
    );
    const transferred = transfer.resulting.find((row) => row.stakeholderId === benId)!;
    const retained = transfer.resulting.find((row) => row.stakeholderId === adaId)!;
    expect(transferred.costBasisCents).toBe("4001");
    expect(retained.costBasisCents).toBe("6002");
    expect(BigInt(transferred.costBasisCents!) + BigInt(retained.costBasisCents!)).toBe(10_003n);
    const transferEvent = await f.owner.equityTransaction.findUniqueOrThrow({
      where: { id: transfer.transactionId },
    });
    expect(transferEvent.before).toMatchObject({ costBasisCents: "10003" });
    expect(transferEvent.after).toMatchObject({
      costBasisCents: "10003",
      resultingCertificates: [
        expect.objectContaining({ costBasisCents: "4001" }),
        expect.objectContaining({ costBasisCents: "6002" }),
      ],
    });

    for (const [kind, basis, disposed, remainder] of [
      ["cancel", "2", "0", "2"],
      ["repurchase", "1001", "333", "668"],
      ["cancel", "0", "0", "0"],
    ] as const) {
      const certificate = await f.as(f.mine, () =>
        createEquityCertificate(f.prisma, f.mine, {
          stakeholderId: adaId,
          shareClassId: commonId,
          quantity: "3",
          costBasisCents: basis,
          issueDate: "2024-02-01",
        }),
      );
      const result = await f.as(f.mine, () =>
        kind === "cancel"
          ? cancelEquityCertificate(f.prisma, f.mine, {
              certificateId: certificate.id,
              quantity: "1",
              effectiveDate: "2024-03-01",
              reason: "write_off_cancel",
            })
          : repurchaseEquityCertificate(f.prisma, f.mine, {
              certificateId: certificate.id,
              quantity: "1",
              effectiveDate: "2024-03-01",
              reason: "buyback",
            }),
      );
      expect(result.resulting[0]?.costBasisCents).toBe(remainder);
      const event = await f.owner.equityTransaction.findUniqueOrThrow({
        where: { id: result.transactionId },
      });
      expect(event.after).toMatchObject({ disposedCostBasisCents: disposed });
    }
  });

  it("refuses a closed certificate and a quantity above the holding", async () => {
    const source = await issue("100");
    await expect(
      f.as(f.mine, () =>
        repurchaseEquityCertificate(f.prisma, f.mine, {
          certificateId: source.id,
          quantity: "101",
          effectiveDate: "2024-03-01",
          reason: "buyback",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await f.as(f.mine, () =>
      cancelEquityCertificate(f.prisma, f.mine, {
        certificateId: source.id,
        quantity: "100",
        effectiveDate: "2024-03-01",
        reason: "write_off_cancel",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        transferEquityCertificate(f.prisma, f.mine, {
          certificateId: source.id,
          toStakeholderId: benId,
          quantity: "100",
          effectiveDate: "2024-03-02",
          reason: "gift",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("keeps another user and another space out", async () => {
    const source = await issue("100");
    for (const scope of [f.sameSpace, f.otherSpace]) {
      await expect(
        f.as(scope, () =>
          cancelEquityCertificate(f.prisma, scope, {
            certificateId: source.id,
            quantity: "100",
            effectiveDate: "2024-03-01",
            reason: "write_off_cancel",
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () =>
          updateEquityCertificate(f.prisma, scope, {
            id: source.id,
            adminNotes: "foreign update",
          }),
        ),
      ).rejects.toThrow();
    }
    const foreign = await f.as(f.sameSpace, () =>
      createEquityStakeholder(f.prisma, f.sameSpace, { type: "individual", name: "Cy Other" }),
    );
    await expect(
      f.as(f.mine, () =>
        transferEquityCertificate(f.prisma, f.mine, {
          certificateId: source.id,
          toStakeholderId: foreign.id,
          quantity: "100",
          effectiveDate: "2024-03-01",
          reason: "gift",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const still = await f.as(f.mine, () => getEquityCertificate(f.prisma, f.mine, source.id));
    expect(still).toMatchObject({ status: "outstanding", adminNotes: null });
  });

  it("totals the certificates a filter matches, only the caller's", async () => {
    const all = await f.as(f.mine, () => equityCertificateTotals(f.prisma, f.mine, {}));
    const page = await f.owner.equityCertificate.aggregate({
      where: { spaceId: f.mine.spaceId, userId: f.mine.userId },
      _count: { _all: true },
      _sum: { quantity: true },
    });
    expect(all).toEqual({ count: page._count._all, shares: String(page._sum.quantity) });
    const outstanding = await f.as(f.mine, () =>
      equityCertificateTotals(f.prisma, f.mine, { status: ["outstanding"] }),
    );
    expect(outstanding.count).toBeLessThan(all.count);
    for (const scope of [f.sameSpace, f.otherSpace])
      expect(await f.as(scope, () => equityCertificateTotals(f.prisma, scope, {}))).toEqual({
        count: 0,
        shares: "0",
      });
  });
});
