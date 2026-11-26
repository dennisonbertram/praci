import { EquityPricedRoundResultSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "../client.js";
import { IsolationError } from "../scope.js";
import { EquityInputError } from "./ledger.js";
import {
  createEquityFundingRound,
  listEquityFundingRounds,
  updateEquityFundingRound,
} from "./rounds.js";
import {
  createEquityCertificate,
  createEquityConvertible,
  getEquityConvertible,
  updateEquityCertificate,
  updateEquityConvertible,
} from "./securities.js";
import {
  cancelEquityConvertible,
  convertEquityPricedRound,
  equityConvertibleTotals,
  getEquitySafeFunding,
  previewEquityPricedRound,
  setEquitySafeFunding,
} from "./securities-convertibles.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function barrierBeforeUnprotectedConvertibleRead(prisma: PrismaClient): PrismaClient {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const arrive = async () => {
    arrived += 1;
    if (arrived === 2) release();
    await gate;
  };
  const wrap = (tx: object) => {
    let locked = false;
    return new Proxy(tx, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (
          typeof property === "string" &&
          ["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"].includes(property) &&
          typeof value === "function"
        )
          return (...args: unknown[]) => {
            if (String(args[0] ?? "").includes("FOR UPDATE")) locked = true;
            return Reflect.apply(value, target, args);
          };
        if (property !== "equityConvertible" || !value || typeof value !== "object") return value;
        return new Proxy(value, {
          get(delegate, method, delegateReceiver) {
            const operation = Reflect.get(delegate, method, delegateReceiver);
            if (
              !["findFirst", "findMany"].includes(String(method)) ||
              typeof operation !== "function"
            )
              return operation;
            return async (...args: unknown[]) => {
              const result = await Reflect.apply(operation, delegate, args);
              if (!locked) await arrive();
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
          (tx: object) => Reflect.apply(callback, undefined, [wrap(tx)]),
          ...args.slice(1),
        ]);
      };
    },
  });
}

async function pricingFixture(name: string, baseShares: string) {
  const fixture = await equityFixture(name);
  const stakeholder = await fixture.as(fixture.mine, () =>
    createEquityStakeholder(fixture.prisma, fixture.mine, {
      type: "individual",
      name: "Pricing Example",
    }),
  );
  const common = await fixture.owner.equityShareClass.create({
    data: { ...fixture.mine, name: "Common", prefix: "CS", classType: "common" },
  });
  const preferred = await fixture.owner.equityShareClass.create({
    data: { ...fixture.mine, name: "Series A", prefix: "PA", classType: "preferred" },
  });
  for (const shareClassId of [common.id, preferred.id])
    await fixture.owner.equityShareClassVersion.create({
      data: {
        ...fixture.mine,
        shareClassId,
        documentDate: day("2024-01-01"),
        authorizedShares: 100_000_000n,
      },
    });
  await fixture.as(fixture.mine, () =>
    createEquityCertificate(fixture.prisma, fixture.mine, {
      stakeholderId: stakeholder.id,
      shareClassId: common.id,
      quantity: baseShares,
      issueDate: "2024-01-01",
    }),
  );
  return { fixture, stakeholderId: stakeholder.id, commonId: common.id, preferredId: preferred.id };
}

describeEquityPostgres("equity convertible transactions (PostgreSQL)", () => {
  let f: EquityFixture;
  let commonId = "";
  let seriesId = "";
  let adaId = "";

  async function shareClass(name: string, prefix: string) {
    const row = await f.owner.equityShareClass.create({
      data: { ...f.mine, name, prefix, classType: prefix === "CS" ? "common" : "preferred" },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        ...f.mine,
        shareClassId: row.id,
        documentDate: day("2024-01-01"),
        authorizedShares: 100_000_000n,
      },
    });
    return row.id;
  }

  const safe = (cap: string | null) =>
    f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "50000000",
        valuationCapCents: cap,
        valuationCapType: cap ? "pre_money" : null,
        issueDate: "2024-01-01",
      }),
    );

  beforeAll(async () => {
    f = await equityFixture("convertible-transactions");
    adaId = (
      await f.as(f.mine, () =>
        createEquityStakeholder(f.prisma, f.mine, { type: "individual", name: "Ada Example" }),
      )
    ).id;
    commonId = await shareClass("Common", "CS");
    seriesId = await shareClass("Series A Preferred", "PA");
    await f.as(f.mine, () =>
      createEquityCertificate(f.prisma, f.mine, {
        stakeholderId: adaId,
        shareClassId: commonId,
        quantity: "8000000",
        issueDate: "2024-01-01",
      }),
    );
  });

  afterAll(async () => {
    await f?.close();
  });

  it("cancels an outstanding SAFE once", async () => {
    const row = await safe(null);
    const canceled = await f.as(f.mine, () =>
      cancelEquityConvertible(f.prisma, f.mine, {
        id: row.id,
        canceledOn: "2024-06-01",
        reason: "Returned",
      }),
    );
    expect(canceled).toMatchObject({
      status: "canceled",
      canceledOn: "2024-06-01",
      closedOn: "2024-06-01",
      cancellationReason: "Returned",
    });
    const transaction = await f.owner.equityTransaction.findFirstOrThrow({
      where: { ...f.mine, kind: "cancel", convertibleId: row.id },
    });
    expect(transaction.effectiveDate).toEqual(day("2024-06-01"));
    expect(transaction.before).toMatchObject({ status: "outstanding", closedOn: null });
    expect(transaction.after).toMatchObject({ status: "canceled", closedOn: "2024-06-01" });
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, { id: row.id, canceledOn: null }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () =>
        cancelEquityConvertible(f.prisma, f.mine, {
          id: row.id,
          canceledOn: "2024-06-02",
          reason: "Again",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("persists label edits and prevents generic convertible lifecycle forgery", async () => {
    const row = await safe(null);
    const certificateId = (
      await f.owner.equityCertificate.findFirstOrThrow({
        where: { ...f.mine, shareClassId: commonId },
        select: { id: true },
      })
    ).id;
    const renamed = await f.as(f.mine, () =>
      updateEquityConvertible(f.prisma, f.mine, { id: row.id, label: "SAFE-900001" }),
    );
    expect(renamed.label).toBe("SAFE-900001");
    const other = await safe(null);
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, { id: row.id, label: "NOTE-900001" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, { id: row.id, label: other.label }),
      ),
    ).rejects.toThrow();
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, {
          id: row.id,
          status: "converted",
          convertedToId: certificateId,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () =>
        createEquityConvertible(f.prisma, f.mine, {
          stakeholderId: adaId,
          kind: "safe",
          principalCents: "10000",
          issueDate: "2024-01-01",
          status: "converted",
          convertedToId: certificateId,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.sameSpace, () =>
        updateEquityConvertible(f.prisma, f.sameSpace, { id: row.id, label: "SAFE-900002" }),
      ),
    ).rejects.toBeInstanceOf(IsolationError);
  });

  it("rejects future-issued SAFEs during preview", async () => {
    const future = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        issueDate: "2025-01-02",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        previewEquityPricedRound(f.prisma, f.mine, {
          convertibleIds: [future.id],
          toShareClassId: seriesId,
          preMoneyValuationCents: "800000000",
          newMoneyCents: "0",
          asOf: "2025-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("rejects notes with invalid legal dates during preview", async () => {
    const invalid = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "note",
        principalCents: "10000",
        issueDate: "2024-01-01",
        interestRate: "5",
        interestStartDate: "2024-01-01",
        interestType: "simple",
        dayCountConvention: "actual_365",
        maturityDate: "2023-12-31",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        previewEquityPricedRound(f.prisma, f.mine, {
          convertibleIds: [invalid.id],
          toShareClassId: seriesId,
          preMoneyValuationCents: "800000000",
          newMoneyCents: "0",
          asOf: "2025-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("previews and converts SAFEs in a priced round at the best price", async () => {
    const capped = await safe("400000000");
    const input = {
      convertibleIds: [capped.id],
      toShareClassId: seriesId,
      preMoneyValuationCents: "800000000",
      newMoneyCents: "200000000",
      asOf: "2025-01-01",
    };
    const preview = await f.as(f.mine, () => previewEquityPricedRound(f.prisma, f.mine, input));
    // The $4,000,000 cap on 8,000,000 shares gives $0.50, so $500,000 buys 1,000,000 shares. Those
    // count pre-money: $8,000,000 / 9,000,000 shares = $0.8889, so $2,000,000 buys 2,250,000.
    expect(preview.pricePerShare).toBe("0.8888888889");
    expect(preview.convertibles[0]).toMatchObject({ method: "cap", shares: "1000000" });
    expect(preview.newMoneyShares).toBe("2250000");
    const result = await f.as(f.mine, () => convertEquityPricedRound(f.prisma, f.mine, input));
    expect(() => EquityPricedRoundResultSchema.parse(result)).not.toThrow();
    expect(result.certificates[0]).toMatchObject({
      shareClassId: seriesId,
      quantity: "1000000",
      stakeholderId: adaId,
    });
    const transaction = await f.owner.equityTransaction.findFirstOrThrow({
      where: { ...f.mine, kind: "convert", convertibleId: capped.id },
    });
    expect(transaction.after).toMatchObject({
      status: "converted",
      closedOn: input.asOf,
      resultingCertificates: [
        expect.objectContaining({
          quantity: "1000000",
          stakeholderId: adaId,
          shareClassId: seriesId,
          pricePerShare: result.certificates[0]!.pricePerShare,
          pricePaidPerShare: result.certificates[0]!.pricePaidPerShare,
          debtCanceledCents: result.certificates[0]!.debtCanceledCents,
          transactionValueCents: result.certificates[0]!.transactionValueCents,
        }),
      ],
    });
    const after = await f.as(f.mine, () => getEquityConvertible(f.prisma, f.mine, capped.id));
    expect(after).toMatchObject({
      status: "converted",
      convertedToId: result.certificates[0]!.id,
      closedOn: input.asOf,
    });
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, { id: capped.id, status: "outstanding" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(f.mine, () =>
        updateEquityConvertible(f.prisma, f.mine, {
          id: capped.id,
          principalCents: "1000",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const metadata = await f.as(f.mine, () =>
      updateEquityConvertible(f.prisma, f.mine, {
        id: capped.id,
        adminNotes: "Audited note",
      }),
    );
    expect(metadata.adminNotes).toBe("Audited note");
    await expect(
      f.as(f.mine, () => convertEquityPricedRound(f.prisma, f.mine, input)),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("keeps converted-note interest on the immutable conversion date", async () => {
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
    const input = {
      convertibleIds: [note.id],
      toShareClassId: seriesId,
      preMoneyValuationCents: "800000000",
      newMoneyCents: "200000000",
      asOf: "2024-06-01",
    };
    const conversion = await f.as(f.mine, () => convertEquityPricedRound(f.prisma, f.mine, input));
    expect(conversion.certificates).toHaveLength(1);
    await f.owner.equityCertificate.update({
      where: { id: conversion.certificates[0]!.id },
      data: { issueDate: day("2024-12-01") },
    });
    const after = await f.as(f.mine, () => getEquityConvertible(f.prisma, f.mine, note.id));
    expect(after).toMatchObject({
      status: "converted",
      closedOn: "2024-06-01",
      interestAccruedCents: "4164",
    });
  });

  it("translates impossible post-money cap pricing into an input error", async () => {
    const impossible = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        valuationCapCents: "10000",
        valuationCapType: "post_money",
        issueDate: "2024-01-01",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        previewEquityPricedRound(f.prisma, f.mine, {
          convertibleIds: [impossible.id],
          toShareClassId: seriesId,
          preMoneyValuationCents: "800000000",
          newMoneyCents: "0",
          asOf: "2025-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("uses the post-money cap ownership base in stored SAFE execution", async () => {
    const g = await pricingFixture("post-money-store", "9000000");
    try {
      const postMoneySafe = await g.fixture.as(g.fixture.mine, () =>
        createEquityConvertible(g.fixture.prisma, g.fixture.mine, {
          stakeholderId: g.stakeholderId,
          kind: "safe",
          principalCents: "100000000",
          valuationCapCents: "1000000000",
          valuationCapType: "post_money",
          issueDate: "2024-01-01",
        }),
      );
      const result = await g.fixture.as(g.fixture.mine, () =>
        convertEquityPricedRound(g.fixture.prisma, g.fixture.mine, {
          convertibleIds: [postMoneySafe.id],
          toShareClassId: g.preferredId,
          preMoneyValuationCents: "100000000000",
          newMoneyCents: "0",
          asOf: "2025-01-01",
        }),
      );
      expect(result.certificates[0]?.quantity).toBe("1000000");
    } finally {
      await g.fixture.close();
    }
  });

  it("serializes concurrent conversions of one SAFE into exactly one certificate", async () => {
    const row = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        issueDate: "2024-01-01",
      }),
    );
    const interleaved = barrierBeforeUnprotectedConvertibleRead(f.prisma);
    const beforeCount = await f.owner.equityCertificate.count({
      where: { ...f.mine, stakeholderId: adaId, roundId: null, pricePerShare: { not: null } },
    });
    const input = {
      convertibleIds: [row.id],
      toShareClassId: seriesId,
      preMoneyValuationCents: "800000000",
      newMoneyCents: "0",
      asOf: "2025-01-01",
    };
    const results = await Promise.allSettled([
      f.as(f.mine, () => convertEquityPricedRound(interleaved, f.mine, input)),
      f.as(f.mine, () => convertEquityPricedRound(interleaved, f.mine, input)),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const count = await f.owner.equityCertificate.count({
      where: { ...f.mine, stakeholderId: adaId, roundId: null, pricePerShare: { not: null } },
    });
    expect(count - beforeCount).toBe(1);
  });

  it("serializes different SAFE batches against target-class capacity", async () => {
    const limited = await f.owner.equityShareClass.create({
      data: { ...f.mine, name: "Limited", prefix: "LM", classType: "preferred" },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        ...f.mine,
        shareClassId: limited.id,
        documentDate: day("2024-01-01"),
        authorizedShares: 75n,
      },
    });
    const base = await f.owner.equityCertificate.aggregate({
      where: { ...f.mine, status: { not: "canceled" } },
      _sum: { quantity: true },
    });
    const preMoney = ((base._sum.quantity ?? 1n) * 100n).toString();
    const rows = await Promise.all(
      ["5000", "5000"].map((principalCents) =>
        f.as(f.mine, () =>
          createEquityConvertible(f.prisma, f.mine, {
            stakeholderId: adaId,
            kind: "safe",
            principalCents,
            issueDate: "2024-01-01",
          }),
        ),
      ),
    );
    const interleaved = barrierBeforeUnprotectedConvertibleRead(f.prisma);
    const results = await Promise.allSettled(
      rows.map((row) =>
        f.as(f.mine, () =>
          convertEquityPricedRound(interleaved, f.mine, {
            convertibleIds: [row.id],
            toShareClassId: limited.id,
            preMoneyValuationCents: preMoney,
            newMoneyCents: "0",
            asOf: "2025-01-01",
          }),
        ),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("serializes a cancellation racing its convertible's conversion", async () => {
    const row = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        issueDate: "2024-01-01",
      }),
    );
    const interleaved = barrierBeforeUnprotectedConvertibleRead(f.prisma);
    const results = await Promise.allSettled([
      f.as(f.mine, () =>
        cancelEquityConvertible(interleaved, f.mine, {
          id: row.id,
          canceledOn: "2024-06-01",
          reason: "Returned",
        }),
      ),
      f.as(f.mine, () =>
        convertEquityPricedRound(interleaved, f.mine, {
          convertibleIds: [row.id],
          toShareClassId: seriesId,
          preMoneyValuationCents: "800000000",
          newMoneyCents: "0",
          asOf: "2025-01-01",
        }),
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("issues a conversion into a funding round named on close, without counting it as raised", async () => {
    const note = await safe("400000000");
    const result = await f.as(f.mine, () =>
      convertEquityPricedRound(f.prisma, f.mine, {
        convertibleIds: [note.id],
        toShareClassId: seriesId,
        preMoneyValuationCents: "800000000",
        newMoneyCents: "200000000",
        asOf: "2025-02-01",
        newRoundName: "Series A close",
      }),
    );
    const roundId = result.certificates[0]!.roundId;
    expect(roundId).toBeTruthy();
    const rounds = await f.as(f.mine, () =>
      listEquityFundingRounds(f.prisma, f.mine, { pageSize: 50 }),
    );
    const round = rounds.items.find((row) => row.id === roundId)!;
    expect(round).toMatchObject({
      name: "Series A close",
      closingDate: "2025-02-01",
      sharesIssued: result.certificates[0]!.quantity,
      securityCount: 1,
      // A conversion is not new money: the SAFE's principal stays with the SAFE's own round.
      cashRaisedCents: "0",
    });
    const after = await f.as(f.mine, () => getEquityConvertible(f.prisma, f.mine, note.id));
    expect(after.roundId).toBe(note.roundId);
    // A second close cannot take the same round name.
    const other = await safe("400000000");
    await expect(
      f.as(f.mine, () =>
        convertEquityPricedRound(f.prisma, f.mine, {
          convertibleIds: [other.id],
          toShareClassId: seriesId,
          preMoneyValuationCents: "800000000",
          newMoneyCents: "0",
          asOf: "2025-02-01",
          newRoundName: "Series A close",
        }),
      ),
    ).rejects.toThrow("A funding round with this name exists");
  });

  it("prices a round once and rejects a later batch or changed terms", async () => {
    const seq = await pricingFixture("sequential-pricing", "1000");
    const batch = await pricingFixture("batch-pricing", "1000");
    try {
      const sequentialRound = await seq.fixture.as(seq.fixture.mine, () =>
        createEquityFundingRound(seq.fixture.prisma, seq.fixture.mine, {
          name: "Sequential",
          startDate: "2024-01-01",
        }),
      );
      const sequentialSafes = await Promise.all(
        ["First", "Second"].map(() =>
          seq.fixture.as(seq.fixture.mine, () =>
            createEquityConvertible(seq.fixture.prisma, seq.fixture.mine, {
              stakeholderId: seq.stakeholderId,
              kind: "safe",
              principalCents: "10000",
              issueDate: "2024-01-01",
            }),
          ),
        ),
      );
      const terms = {
        toShareClassId: seq.preferredId,
        preMoneyValuationCents: "100000",
        newMoneyCents: "0",
        asOf: "2025-01-01",
        roundId: sequentialRound.id,
      };
      const beforePreviewCount = await seq.fixture.owner.equityCertificate.count({
        where: { ...seq.fixture.mine, roundId: sequentialRound.id },
      });
      const firstPreview = await seq.fixture.as(seq.fixture.mine, () =>
        previewEquityPricedRound(seq.fixture.prisma, seq.fixture.mine, {
          ...terms,
          convertibleIds: [sequentialSafes[0]!.id],
        }),
      );
      // $100 of $1,000 pre-money converting at the round price: S = 1,000 / 0.9 shares.
      expect(firstPreview.convertibles[0]?.shares).toBe("111");
      expect(
        await seq.fixture.owner.equityCertificate.count({
          where: { ...seq.fixture.mine, roundId: sequentialRound.id },
        }),
      ).toBe(beforePreviewCount);
      const previewSnapshot = await seq.fixture.owner.equityFundingRound.findFirstOrThrow({
        where: { id: sequentialRound.id },
        select: { pricingSnapshot: true },
      });
      expect(previewSnapshot.pricingSnapshot).toBeNull();
      const firstResult = await seq.fixture.as(seq.fixture.mine, () =>
        convertEquityPricedRound(seq.fixture.prisma, seq.fixture.mine, {
          ...terms,
          convertibleIds: [sequentialSafes[0]!.id],
        }),
      );
      expect(firstResult.certificates[0]?.quantity).toBe("111");
      const snapshotRows = await seq.fixture.owner.$queryRawUnsafe<
        Array<{ pricingSnapshot: unknown }>
      >(
        'SELECT "pricingSnapshot" FROM "equity_funding_rounds" WHERE "id" = $1',
        sequentialRound.id,
      );
      expect(snapshotRows[0]?.pricingSnapshot).toMatchObject({
        preMoneyValuationCents: "100000",
        newMoneyCents: "0",
        asOf: "2025-01-01",
        targetShareClassId: seq.preferredId,
        baseFullyDilutedShares: "1000",
        priorConversionShares: "0",
        priorConversionCount: 0,
        hasPostMoneyCaps: false,
      });
      const renamed = await seq.fixture.as(seq.fixture.mine, () =>
        updateEquityFundingRound(seq.fixture.prisma, seq.fixture.mine, {
          id: sequentialRound.id,
          name: "Sequential Renamed",
        }),
      );
      expect(renamed.name).toBe("Sequential Renamed");
      await expect(
        seq.fixture.as(seq.fixture.mine, () =>
          updateEquityFundingRound(seq.fixture.prisma, seq.fixture.mine, {
            id: sequentialRound.id,
            preMoneyValuationCents: "900000",
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
      // Conversion shares are in the pre-money count, so a later batch cannot share the price.
      await expect(
        seq.fixture.as(seq.fixture.mine, () =>
          previewEquityPricedRound(seq.fixture.prisma, seq.fixture.mine, {
            ...terms,
            convertibleIds: [sequentialSafes[1]!.id],
          }),
        ),
      ).rejects.toThrow(/one batch/);
      const countBeforeSecond = await seq.fixture.owner.equityCertificate.count({
        where: { ...seq.fixture.mine, roundId: sequentialRound.id },
      });
      await expect(
        seq.fixture.as(seq.fixture.mine, () =>
          convertEquityPricedRound(seq.fixture.prisma, seq.fixture.mine, {
            ...terms,
            convertibleIds: [sequentialSafes[1]!.id],
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
      expect(
        await seq.fixture.owner.equityCertificate.count({
          where: { ...seq.fixture.mine, roundId: sequentialRound.id },
        }),
      ).toBe(countBeforeSecond);

      const batchRound = await batch.fixture.as(batch.fixture.mine, () =>
        createEquityFundingRound(batch.fixture.prisma, batch.fixture.mine, {
          name: "Same Batch",
          startDate: "2024-01-01",
        }),
      );
      const batchSafes = await Promise.all(
        ["First", "Second"].map(() =>
          batch.fixture.as(batch.fixture.mine, () =>
            createEquityConvertible(batch.fixture.prisma, batch.fixture.mine, {
              stakeholderId: batch.stakeholderId,
              kind: "safe",
              principalCents: "10000",
              issueDate: "2024-01-01",
            }),
          ),
        ),
      );
      const batchResult = await batch.fixture.as(batch.fixture.mine, () =>
        convertEquityPricedRound(batch.fixture.prisma, batch.fixture.mine, {
          convertibleIds: batchSafes.map((row) => row.id),
          toShareClassId: batch.preferredId,
          preMoneyValuationCents: "100000",
          newMoneyCents: "0",
          asOf: "2025-01-01",
          roundId: batchRound.id,
        }),
      );
      // Two $100 SAFEs on $1,000 pre-money: 1,000 / 0.8 = 1,250 shares, 125 each.
      expect(batchResult.certificates.map((certificate) => certificate.quantity)).toEqual([
        "125",
        "125",
      ]);
    } finally {
      await Promise.all([seq.fixture.close(), batch.fixture.close()]);
    }
  });

  it("converts a fresh round, retries one that failed midway, and rejects one already converted", async () => {
    const g = await pricingFixture("round-retry", "1000");
    try {
      const { fixture } = g;
      const round = await fixture.as(fixture.mine, () =>
        createEquityFundingRound(fixture.prisma, fixture.mine, {
          name: "Retry",
          startDate: "2024-01-01",
        }),
      );
      const safe = await fixture.as(fixture.mine, () =>
        createEquityConvertible(fixture.prisma, fixture.mine, {
          stakeholderId: g.stakeholderId,
          kind: "safe",
          principalCents: "10000",
          issueDate: "2024-01-01",
        }),
      );
      const terms = {
        convertibleIds: [safe.id],
        toShareClassId: g.preferredId,
        preMoneyValuationCents: "100000",
        newMoneyCents: "0",
        asOf: "2025-01-01",
        roundId: round.id,
      };
      const snapshotOf = async () =>
        (
          await fixture.owner.equityFundingRound.findFirstOrThrow({
            where: { id: round.id },
            select: { pricingSnapshot: true },
          })
        ).pricingSnapshot;
      // A failure after the snapshot is written (here, the last write of the conversion) rolls
      // the whole conversion back, so no snapshot is left behind to block the retry.
      await fixture.owner.$executeRawUnsafe(`
        CREATE FUNCTION capfix_fail_convert() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`);
      await fixture.owner.$executeRawUnsafe(`
        CREATE TRIGGER capfix_fail_convert BEFORE INSERT ON "equity_transactions"
        FOR EACH ROW WHEN (NEW."kind" = 'convert') EXECUTE FUNCTION capfix_fail_convert()`);
      try {
        await expect(
          fixture.as(fixture.mine, () =>
            convertEquityPricedRound(fixture.prisma, fixture.mine, terms),
          ),
        ).rejects.toThrow();
      } finally {
        await fixture.owner.$executeRawUnsafe(
          'DROP TRIGGER capfix_fail_convert ON "equity_transactions"',
        );
        await fixture.owner.$executeRawUnsafe("DROP FUNCTION capfix_fail_convert()");
      }
      expect(await snapshotOf()).toBeNull();
      expect(
        (await fixture.owner.equityConvertible.findFirstOrThrow({ where: { id: safe.id } })).status,
      ).toBe("outstanding");
      const retried = await fixture.as(fixture.mine, () =>
        convertEquityPricedRound(fixture.prisma, fixture.mine, terms),
      );
      // $100 of $1,000 pre-money converting at the round price: S = 1,000 / 0.9 shares.
      expect(retried.certificates[0]?.quantity).toBe("111");
      expect(await snapshotOf()).not.toBeNull();
      // The round is converted now: a repeat, even of the same SAFE, is refused.
      await expect(
        fixture.as(fixture.mine, () =>
          convertEquityPricedRound(fixture.prisma, fixture.mine, terms),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    } finally {
      await g.fixture.close();
    }
  });

  it("rejects adding a post-money SAFE after an earlier batch in the round", async () => {
    const round = await f.as(f.mine, () =>
      createEquityFundingRound(f.prisma, f.mine, {
        name: "Post Money Cohort",
        startDate: "2024-01-01",
      }),
    );
    const uncapped = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        issueDate: "2024-01-01",
      }),
    );
    const commonTerms = {
      toShareClassId: seriesId,
      preMoneyValuationCents: "800000000",
      newMoneyCents: "0",
      asOf: "2025-01-01",
      roundId: round.id,
    };
    await f.as(f.mine, () =>
      convertEquityPricedRound(f.prisma, f.mine, {
        ...commonTerms,
        convertibleIds: [uncapped.id],
      }),
    );
    const postMoney = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        valuationCapCents: "1000000",
        valuationCapType: "post_money",
        issueDate: "2024-01-01",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        convertEquityPricedRound(f.prisma, f.mine, {
          ...commonTerms,
          convertibleIds: [postMoney.id],
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("rejects a post-money append after the earlier conversion certificate is detached from its round", async () => {
    const round = await f.as(f.mine, () =>
      createEquityFundingRound(f.prisma, f.mine, {
        name: "Detached Conversion Round",
        startDate: "2024-01-01",
      }),
    );
    const uncapped = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        issueDate: "2024-01-01",
      }),
    );
    const terms = {
      toShareClassId: seriesId,
      preMoneyValuationCents: "800000000",
      newMoneyCents: "0",
      asOf: "2025-01-01",
      roundId: round.id,
    };
    const first = await f.as(f.mine, () =>
      convertEquityPricedRound(f.prisma, f.mine, {
        ...terms,
        convertibleIds: [uncapped.id],
      }),
    );
    await f.as(f.mine, () =>
      updateEquityCertificate(f.prisma, f.mine, {
        id: first.certificates[0]!.id,
        roundId: null,
      }),
    );
    const postMoney = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        valuationCapCents: "1000000",
        valuationCapType: "post_money",
        issueDate: "2024-01-01",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        convertEquityPricedRound(f.prisma, f.mine, {
          ...terms,
          convertibleIds: [postMoney.id],
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    expect(
      await f.owner.equityConvertible.findFirstOrThrow({
        where: { ...f.mine, id: postMoney.id },
      }),
    ).toMatchObject({ status: "outstanding", convertedToId: null });
  });

  it("honors a declared round issue price and accepts a matching inferred price", async () => {
    const g = await pricingFixture("declared-issue-price", "8000000");
    try {
      const conflictingRound = await g.fixture.as(g.fixture.mine, () =>
        createEquityFundingRound(g.fixture.prisma, g.fixture.mine, {
          name: "Declared Two Dollar Price",
          startDate: "2024-01-01",
          originalIssuePrice: "2",
        }),
      );
      const conflictingSafe = await g.fixture.as(g.fixture.mine, () =>
        createEquityConvertible(g.fixture.prisma, g.fixture.mine, {
          stakeholderId: g.stakeholderId,
          kind: "safe",
          principalCents: "10000",
          issueDate: "2024-01-01",
        }),
      );
      const input = {
        convertibleIds: [conflictingSafe.id],
        toShareClassId: g.preferredId,
        preMoneyValuationCents: "800000000",
        newMoneyCents: "0",
        asOf: "2025-01-01",
        roundId: conflictingRound.id,
      };
      await expect(
        g.fixture.as(g.fixture.mine, () =>
          convertEquityPricedRound(g.fixture.prisma, g.fixture.mine, input),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
      expect(
        await g.fixture.owner.equityFundingRound.findUniqueOrThrow({
          where: { id: conflictingRound.id },
        }),
      ).toMatchObject({ pricingSnapshot: null, originalIssuePrice: expect.anything() });
      expect(
        await g.fixture.owner.equityConvertible.findFirstOrThrow({
          where: { ...g.fixture.mine, id: conflictingSafe.id },
        }),
      ).toMatchObject({ status: "outstanding", convertedToId: null });

      const matchingRound = await g.fixture.as(g.fixture.mine, () =>
        createEquityFundingRound(g.fixture.prisma, g.fixture.mine, {
          name: "Declared Matching Price",
          startDate: "2024-01-01",
          // $100 converting at the round price: ($8,000,000 - $100) / 8,000,000 shares.
          originalIssuePrice: "0.9999875",
        }),
      );
      const matchingSafe = await g.fixture.as(g.fixture.mine, () =>
        createEquityConvertible(g.fixture.prisma, g.fixture.mine, {
          stakeholderId: g.stakeholderId,
          kind: "safe",
          principalCents: "10000",
          issueDate: "2024-01-01",
        }),
      );
      const matchingResult = await g.fixture.as(g.fixture.mine, () =>
        convertEquityPricedRound(g.fixture.prisma, g.fixture.mine, {
          ...input,
          convertibleIds: [matchingSafe.id],
          roundId: matchingRound.id,
        }),
      );
      expect(matchingResult.preview.pricePerShare).toBe("0.9999875000");
      const matchingRoundAfter = await g.fixture.owner.equityFundingRound.findUniqueOrThrow({
        where: { id: matchingRound.id },
      });
      expect(matchingRoundAfter.originalIssuePrice?.toString()).toBe("0.9999875");
    } finally {
      await g.fixture.close();
    }
  });

  it("rejects appending a later cohort after a post-money SAFE cohort", async () => {
    const round = await f.as(f.mine, () =>
      createEquityFundingRound(f.prisma, f.mine, {
        name: "Frozen Post Money Cohort",
        startDate: "2024-01-01",
      }),
    );
    const safeWithPostCap = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        valuationCapCents: "1000000000",
        valuationCapType: "post_money",
        issueDate: "2024-01-01",
      }),
    );
    const terms = {
      toShareClassId: seriesId,
      preMoneyValuationCents: "100000000000",
      newMoneyCents: "0",
      asOf: "2025-01-01",
      roundId: round.id,
    };
    await f.as(f.mine, () =>
      convertEquityPricedRound(f.prisma, f.mine, {
        ...terms,
        convertibleIds: [safeWithPostCap.id],
      }),
    );
    const anotherSafe = await f.as(f.mine, () =>
      createEquityConvertible(f.prisma, f.mine, {
        stakeholderId: adaId,
        kind: "safe",
        principalCents: "10000",
        issueDate: "2024-01-01",
      }),
    );
    await expect(
      f.as(f.mine, () =>
        convertEquityPricedRound(f.prisma, f.mine, {
          ...terms,
          convertibleIds: [anotherSafe.id],
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("keeps another user and another space out", async () => {
    const row = await safe(null);
    for (const scope of [f.sameSpace, f.otherSpace]) {
      await expect(
        f.as(scope, () =>
          cancelEquityConvertible(f.prisma, scope, {
            id: row.id,
            canceledOn: "2024-06-01",
            reason: "x",
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () =>
          previewEquityPricedRound(f.prisma, scope, {
            convertibleIds: [row.id],
            toShareClassId: seriesId,
            preMoneyValuationCents: "800000000",
            newMoneyCents: "0",
            asOf: "2025-01-01",
          }),
        ),
      ).rejects.toThrow();
    }
  });

  it("totals the SAFEs and notes a filter matches, only the caller's", async () => {
    const rows = await f.owner.equityConvertible.findMany({ where: f.mine });
    const all = await f.as(f.mine, () => equityConvertibleTotals(f.prisma, f.mine, {}));
    expect(all).toEqual({
      count: rows.length,
      principalCents: rows.reduce((sum, row) => sum + row.principalCents, 0n).toString(),
    });
    const canceled = await f.as(f.mine, () =>
      equityConvertibleTotals(f.prisma, f.mine, { status: ["canceled"] }),
    );
    expect(canceled.count).toBe(rows.filter((row) => row.status === "canceled").length);
    for (const scope of [f.sameSpace, f.otherSpace])
      expect(await f.as(scope, () => equityConvertibleTotals(f.prisma, scope, {}))).toEqual({
        count: 0,
        principalCents: "0",
      });
  });

  it("tracks the board-approved SAFE amount against what SAFEs raised", async () => {
    const before = await f.as(f.mine, () => getEquitySafeFunding(f.prisma, f.mine));
    expect(before.approvedCents).toBeNull();
    const raised = BigInt(before.raisedCents);
    await expect(
      f.as(f.mine, () =>
        setEquitySafeFunding(f.prisma, f.mine, { approvedCents: (raised - 1n).toString() }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const after = await f.as(f.mine, () =>
      setEquitySafeFunding(f.prisma, f.mine, { approvedCents: (raised + 100_000n).toString() }),
    );
    expect(after).toEqual({
      approvedCents: (raised + 100_000n).toString(),
      raisedCents: raised.toString(),
      remainingCents: "100000",
    });
    for (const scope of [f.sameSpace, f.otherSpace])
      expect(
        (await f.as(scope, () => getEquitySafeFunding(f.prisma, scope))).approvedCents,
      ).toBeNull();
  });
});
