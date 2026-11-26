import type { CapTableSnapshot, CapTableSnapshotInput } from "@rakazo/contracts";
import { CapTableSnapshotSchema } from "@rakazo/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { PrismaClient } from "../client.js";
import { importEquitySnapshot } from "./import.js";
import type { EquityScope } from "./ledger.js";
import { EquityInputError } from "./ledger.js";
import { equityOverview } from "./overview.js";
import { getEquityCertificate, getEquityConvertible } from "./securities.js";
import { getEquityPlan } from "./share-classes.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function insertSafeAfterLockQuery(prisma: PrismaClient, insert: () => Promise<void>): PrismaClient {
  let inserted = false;
  const wrapTransaction = (transaction: object) =>
    new Proxy(transaction, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property !== "$queryRaw" || typeof value !== "function") return value;
        return async (...args: unknown[]) => {
          const result = await Reflect.apply(value, target, args);
          const query = String(args[0] ?? "");
          if (!inserted && query.includes('FROM "safes"') && query.includes("FOR UPDATE")) {
            await insert();
            inserted = true;
          }
          return result;
        };
      },
    });
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

const makeSnapshot = (overrides: Partial<CapTableSnapshotInput> = {}): CapTableSnapshot =>
  CapTableSnapshotSchema.parse({
    companyName: "Import Example",
    asOf: "2026-01-31",
    fullyDilutedShares: 0,
    source: "carta",
    sourceRef: null,
    amountRaisedUsd: null,
    optionPoolAvailable: 0,
    latest409a: null,
    shareClasses: [],
    holders: [],
    updatedAt: "2026-01-31T00:00:00.000Z",
    canUndo: false,
    ...overrides,
  });

type SourceSafeInput = {
  investorName: string;
  investorEmail?: string | null;
  amountCents: bigint;
  valuationType?: string;
  capCents?: bigint | null;
  discountPercent?: number | null;
  mfn?: boolean;
  proRata?: boolean;
  investmentDate?: string | null;
  paidAt?: string | null;
  canceledAt?: string | null;
};

describeEquityPostgres("cap table snapshot importer (PostgreSQL)", () => {
  let f: EquityFixture;

  beforeEach(async () => {
    f = await equityFixture("import");
  });

  afterEach(async () => {
    await f?.close();
  });

  const importMine = (snapshot: CapTableSnapshot) =>
    f.as(f.mine, () => importEquitySnapshot(f.prisma, f.mine, snapshot));

  const createSourceSafe = (scope: EquityScope, input: SourceSafeInput) =>
    f.owner.safe.create({
      data: {
        ...scope,
        source: "native",
        investorName: input.investorName,
        investorEmail: input.investorEmail ?? null,
        amountCents: input.amountCents,
        valuationType: input.valuationType ?? "post_money_cap",
        capCents: input.capCents ?? null,
        discountPercent: input.discountPercent ?? null,
        mfn: input.mfn ?? false,
        proRata: input.proRata ?? false,
        investmentDate: input.investmentDate ? day(input.investmentDate) : null,
        paidAt: input.paidAt ? day(input.paidAt) : null,
        canceledAt: input.canceledAt ? day(input.canceledAt) : null,
      },
    });

  const expectNoImportedState = async () => {
    const scope = f.mine;
    expect(await f.owner.equityLedger.findUnique({ where: { spaceId_userId: scope } })).toBeNull();
    const counts = await Promise.all([
      f.owner.equityStakeholder.count({ where: scope }),
      f.owner.equityShareClass.count({ where: scope }),
      f.owner.equityPlan.count({ where: scope }),
      f.owner.equityCertificate.count({ where: scope }),
      f.owner.equityConvertible.count({ where: scope }),
      f.owner.equityOptionGrant.count({ where: scope }),
      f.owner.equityTransaction.count({ where: scope }),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0]);
  };

  it("imports an available pool without inventing grants and creates Common when needed", async () => {
    const snapshot = makeSnapshot({
      fullyDilutedShares: 1_100,
      optionPoolAvailable: 100,
      shareClasses: [{ name: "Series Seed Preferred", shares: 1_000, percent: 100 }],
      holders: [
        {
          name: "Founder",
          security: "Series Seed Preferred",
          shares: 1_000,
          amountUsd: null,
        },
      ],
    });

    const result = await importMine(snapshot);
    const overview = await f.as(f.mine, () => equityOverview(f.prisma, f.mine));
    const plan = await f.owner.equityPlan.findFirstOrThrow({ where: f.mine });

    expect(result).toMatchObject({ plans: 1, certificates: 1, optionGrants: 0 });
    expect(plan.reservedShares).toBe(100n);
    expect(await f.owner.equityOptionGrant.count({ where: f.mine })).toBe(0);
    expect(
      await f.owner.equityShareClass.findFirst({ where: { ...f.mine, name: "Common" } }),
    ).not.toBeNull();
    expect(overview.totals).toMatchObject({
      outstandingShares: "1000",
      fullyDilutedShares: "1100",
      availablePlanShares: "100",
    });
  });

  it.each(["Options", "ISO", "NSO", "RSU", "Warrant", "Convertible Warrants", "SAFE options"])(
    "rejects unsupported %s rows atomically",
    async (security) => {
      const snapshot = makeSnapshot({
        fullyDilutedShares: 1_100,
        shareClasses: [{ name: "Common", shares: 1_000, percent: 100 }],
        holders: [
          { name: "Founder", security: "Common", shares: 1_000 },
          { name: "Unsupported Holder", security, shares: 100 },
        ],
      });

      await expect(importMine(snapshot)).rejects.toThrow(
        new RegExp(`unsupported.*${security}.*Unsupported Holder`, "i"),
      );
      await expectNoImportedState();
    },
  );

  it.each([
    {
      valuationType: "pre_money_cap",
      capCents: 90_000_000n,
      discountPercent: 12.345678,
      mfn: true,
      proRata: true,
      expectedType: "pre_money",
      expectedDate: "2024-02-03",
    },
    {
      valuationType: "post_money_cap",
      capCents: 120_000_000n,
      discountPercent: 99.999999,
      mfn: false,
      proRata: true,
      expectedType: "post_money",
      expectedDate: "2024-03-04",
    },
  ])("preserves matched SAFE terms and the investment date: $valuationType", async (terms) => {
    const date = terms.expectedDate;
    const sourceSafe = await createSourceSafe(f.mine, {
      investorName: "  Safe Investor  ",
      investorEmail: "investor@example.test",
      amountCents: 25_000_000n,
      valuationType: terms.valuationType,
      capCents: terms.capCents,
      discountPercent: terms.discountPercent,
      mfn: terms.mfn,
      proRata: terms.proRata,
      investmentDate: date,
      paidAt: "2024-03-05",
    });
    const snapshot = makeSnapshot({
      holders: [
        {
          name: "Safe Investor",
          email: "INVESTOR@example.test",
          security: "SAFE",
          amountUsd: 250_000,
        },
      ],
    });

    await importMine(snapshot);
    const convertible = await f.owner.equityConvertible.findFirstOrThrow({
      where: { ...f.mine, sourceSafeId: sourceSafe.id },
    });
    const transaction = await f.owner.equityTransaction.findFirstOrThrow({
      where: { ...f.mine, kind: "import", convertibleId: convertible.id },
    });
    const after = transaction.after as Record<string, unknown>;

    expect(convertible).toMatchObject({
      kind: "safe",
      status: "outstanding",
      principalCents: 25_000_000n,
      valuationCapCents: terms.capCents,
      valuationCapType: terms.expectedType,
      mfn: terms.mfn,
      proRata: terms.proRata,
      issueDate: day(date),
      sourceSafeId: sourceSafe.id,
    });
    expect(convertible.discountPercent?.toString()).toBe(String(terms.discountPercent));
    expect(transaction.effectiveDate).toEqual(day(date));
    expect(after).toMatchObject({
      id: convertible.id,
      issueDate: date,
      valuationCapType: terms.expectedType,
      valuationCapCents: terms.capCents?.toString(),
      discountPercent: String(terms.discountPercent),
      mfn: terms.mfn,
      proRata: terms.proRata,
      sourceSafeId: sourceSafe.id,
    });
  });

  it("disambiguates matching source SAFEs only with an exact normalized email", async () => {
    await createSourceSafe(f.mine, {
      investorName: "Same Name",
      investorEmail: "first@example.test",
      amountCents: 10_000n,
      valuationType: "no_valuation",
      investmentDate: "2024-01-01",
      paidAt: "2024-01-02",
    });
    const selected = await createSourceSafe(f.mine, {
      investorName: " same name ",
      investorEmail: "second@example.test",
      amountCents: 10_000n,
      valuationType: "no_valuation",
      investmentDate: "2024-01-03",
      paidAt: "2024-01-04",
    });
    const snapshot = makeSnapshot({
      holders: [
        {
          name: "SAME NAME",
          email: "SECOND@example.test",
          security: "SAFE",
          amountUsd: 100,
        },
      ],
    });

    await importMine(snapshot);
    const linked = await f.owner.equityConvertible.findFirstOrThrow({
      where: { ...f.mine, sourceSafeId: selected.id },
    });
    expect(linked.issueDate).toEqual(day("2024-01-03"));
    expect(await f.owner.equityConvertible.count({ where: f.mine })).toBe(1);
  });

  it("preserves source terms for plural SAFEs rows", async () => {
    const sourceSafe = await createSourceSafe(f.mine, {
      investorName: "Plural Investor",
      investorEmail: "plural@example.test",
      amountCents: 10_000n,
      valuationType: "pre_money_cap",
      capCents: 150_000n,
      discountPercent: 20,
      mfn: true,
      proRata: true,
      investmentDate: "2024-05-06",
      paidAt: "2024-05-07",
    });

    await importMine(
      makeSnapshot({
        holders: [
          {
            name: "Plural Investor",
            email: "plural@example.test",
            security: "SAFEs",
            amountUsd: 100,
          },
        ],
      }),
    );

    const imported = await f.owner.equityConvertible.findFirstOrThrow({
      where: { ...f.mine, sourceSafeId: sourceSafe.id },
    });
    expect(imported).toMatchObject({
      kind: "safe",
      sourceSafeId: sourceSafe.id,
      valuationCapType: "pre_money",
      valuationCapCents: 150_000n,
      mfn: true,
      proRata: true,
      issueDate: day("2024-05-06"),
    });
    expect(imported.discountPercent?.toString()).toBe("20");
  });

  it("rejects multiple matching source SAFEs without an exact email disambiguator", async () => {
    await createSourceSafe(f.mine, {
      investorName: "Ambiguous Investor",
      investorEmail: "one@example.test",
      amountCents: 10_000n,
      investmentDate: "2024-01-01",
      paidAt: "2024-01-02",
    });
    await createSourceSafe(f.mine, {
      investorName: "ambiguous investor",
      investorEmail: "two@example.test",
      amountCents: 10_000n,
      investmentDate: "2024-01-03",
      paidAt: "2024-01-04",
    });

    await expect(
      importMine(
        makeSnapshot({
          holders: [{ name: "Ambiguous Investor", security: "SAFE", amountUsd: 100 }],
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expectNoImportedState();
  });

  it("rejects snapshot SAFE rows that compete for the same source", async () => {
    await createSourceSafe(f.mine, {
      investorName: "Duplicate Snapshot Investor",
      investorEmail: "same@example.test",
      amountCents: 10_000n,
      investmentDate: "2024-01-01",
      paidAt: "2024-01-02",
    });
    const holder = {
      name: "Duplicate Snapshot Investor",
      email: "same@example.test",
      security: "SAFE",
      amountUsd: 100,
    };

    await expect(importMine(makeSnapshot({ holders: [holder, holder] }))).rejects.toBeInstanceOf(
      EquityInputError,
    );
    await expectNoImportedState();
  });

  it.each(["canceled", "unfunded", "missingDate"] as const)(
    "rejects a matched %s SAFE without partial import",
    async (caseName) => {
      await createSourceSafe(f.mine, {
        investorName: "Invalid Source SAFE",
        investorEmail: "invalid@example.test",
        amountCents: 10_000n,
        valuationType: "no_valuation",
        investmentDate: caseName === "missingDate" ? null : "2024-01-01",
        paidAt: caseName === "unfunded" ? null : "2024-01-02",
        canceledAt: caseName === "canceled" ? "2024-01-03" : null,
      });
      const snapshot = makeSnapshot({
        holders: [
          {
            name: "Invalid Source SAFE",
            email: "invalid@example.test",
            security: "SAFE",
            amountUsd: 100,
          },
        ],
      });

      await expect(importMine(snapshot)).rejects.toBeInstanceOf(EquityInputError);
      await expectNoImportedState();
    },
  );

  it("does not link a SAFE when the only candidate has a conflicting known email", async () => {
    const sourceSafe = await createSourceSafe(f.mine, {
      investorName: "Email Conflict",
      investorEmail: "source@example.test",
      amountCents: 10_000n,
      investmentDate: "2024-01-01",
      paidAt: "2024-01-02",
    });

    await importMine(
      makeSnapshot({
        holders: [
          {
            name: "Email Conflict",
            email: "snapshot@example.test",
            security: "SAFE",
            amountUsd: 100,
          },
        ],
      }),
    );

    expect(await f.owner.equityConvertible.findFirstOrThrow({ where: f.mine })).toMatchObject({
      kind: "safe",
      sourceSafeId: null,
    });
    expect(
      await f.owner.equityConvertible.findFirst({
        where: { ...f.mine, sourceSafeId: sourceSafe.id },
      }),
    ).toBeNull();
  });

  it("never links a SAFE Notes snapshot row to a Fundraising SAFE", async () => {
    const sourceSafe = await createSourceSafe(f.mine, {
      investorName: "Note Investor",
      investorEmail: "note@example.test",
      amountCents: 10_000n,
      valuationType: "no_valuation",
      investmentDate: "2024-01-01",
      paidAt: "2024-01-02",
    });

    await importMine(
      makeSnapshot({
        holders: [
          {
            name: "Note Investor",
            email: "note@example.test",
            security: "SAFE Notes",
            amountUsd: 100,
          },
        ],
      }),
    );

    expect(await f.owner.equityConvertible.findFirstOrThrow({ where: f.mine })).toMatchObject({
      kind: "note",
      sourceSafeId: null,
    });
    expect(
      await f.owner.equityConvertible.findFirst({
        where: { ...f.mine, sourceSafeId: sourceSafe.id },
      }),
    ).toBeNull();
  });

  it("does not match a source SAFE that appears after the scoped lock query", async () => {
    let inserted = false;
    const prisma = insertSafeAfterLockQuery(f.prisma, async () => {
      await createSourceSafe(f.mine, {
        investorName: "Appeared After Lock",
        investorEmail: "appeared@example.test",
        amountCents: 10_000n,
        valuationType: "no_valuation",
        investmentDate: "2024-06-01",
        paidAt: "2024-06-02",
      });
      inserted = true;
    });

    await f.as(f.mine, () =>
      importEquitySnapshot(
        prisma,
        f.mine,
        makeSnapshot({
          holders: [
            {
              name: "Appeared After Lock",
              email: "appeared@example.test",
              security: "SAFE",
              amountUsd: 100,
            },
          ],
        }),
      ),
    );

    expect(inserted).toBe(true);
    expect(await f.owner.equityConvertible.findFirstOrThrow({ where: f.mine })).toMatchObject({
      kind: "safe",
      sourceSafeId: null,
    });
  });

  it("stores full after snapshots with each imported record's effective date", async () => {
    const sourceSafe = await createSourceSafe(f.mine, {
      investorName: "SAFE Holder",
      investorEmail: "safe@example.test",
      amountCents: 25_000_000n,
      valuationType: "pre_money_cap",
      capCents: 90_000_000n,
      discountPercent: 12.345678,
      mfn: true,
      proRata: true,
      investmentDate: "2024-02-03",
      paidAt: "2024-02-04",
    });
    await importMine(
      makeSnapshot({
        fullyDilutedShares: 1_100,
        optionPoolAvailable: 100,
        shareClasses: [{ name: "Common", shares: 1_000, percent: 100 }],
        holders: [
          { name: "Founder", security: "Common", shares: 1_000, amountUsd: 1_000 },
          {
            name: "SAFE Holder",
            email: "safe@example.test",
            security: "SAFE",
            amountUsd: 250_000,
          },
        ],
      }),
    );
    const certificate = await f.owner.equityCertificate.findFirstOrThrow({ where: f.mine });
    const convertible = await f.owner.equityConvertible.findFirstOrThrow({ where: f.mine });
    const plan = await f.owner.equityPlan.findFirstOrThrow({ where: f.mine });
    const transactions = await f.owner.equityTransaction.findMany({
      where: { ...f.mine, kind: "import" },
    });
    const certEvent = transactions.find((row) => row.certificateId === certificate.id)!;
    const safeEvent = transactions.find((row) => row.convertibleId === convertible.id)!;
    const planEvent = transactions.find((row) => row.planId === plan.id)!;
    const [certificateAfter, convertibleAfter, planAfter] = await Promise.all([
      f.as(f.mine, () => getEquityCertificate(f.prisma, f.mine, certificate.id)),
      f.as(f.mine, () => getEquityConvertible(f.prisma, f.mine, convertible.id)),
      f.as(f.mine, () => getEquityPlan(f.prisma, f.mine, plan.id)),
    ]);

    expect(certEvent.after).toEqual(certificateAfter);
    expect(safeEvent.after).toEqual({ ...convertibleAfter, sourceSafeId: sourceSafe.id });
    expect(planEvent.after).toEqual(planAfter);
    expect(certEvent.effectiveDate).toEqual(day("2026-01-31"));
    expect(certEvent.after).toMatchObject({
      id: certificate.id,
      issueDate: "2026-01-31",
      label: certificate.label,
      stakeholderId: certificate.stakeholderId,
      shareClassId: certificate.shareClassId,
      quantity: "1000",
      cashPaidCents: "100000",
      status: "outstanding",
    });
    expect(safeEvent.effectiveDate).toEqual(day("2024-02-03"));
    expect(safeEvent.after).toMatchObject({
      id: convertible.id,
      issueDate: "2024-02-03",
      sourceSafeId: sourceSafe.id,
      valuationCapType: "pre_money",
      discountPercent: "12.345678",
      mfn: true,
      proRata: true,
    });
    expect(planEvent.effectiveDate).toEqual(day("2026-01-31"));
    expect(planEvent.after).toMatchObject({
      id: plan.id,
      name: "Imported plan",
      shareClassId: plan.shareClassId,
      reservedShares: "100",
      availableShares: "100",
    });
  });

  it("does not match SAFE sources outside the caller's tenant", async () => {
    const sameSpaceSafe = await createSourceSafe(f.sameSpace, {
      investorName: "Tenant Safe",
      investorEmail: "tenant@example.test",
      amountCents: 10_000n,
      investmentDate: "2024-01-01",
      paidAt: "2024-01-02",
    });
    const otherSpaceSafe = await createSourceSafe(f.otherSpace, {
      investorName: "Tenant Safe",
      investorEmail: "tenant@example.test",
      amountCents: 10_000n,
      investmentDate: "2024-01-03",
      paidAt: "2024-01-04",
    });

    await importMine(
      makeSnapshot({
        holders: [
          {
            name: "Tenant Safe",
            email: "tenant@example.test",
            security: "SAFE",
            amountUsd: 100,
          },
        ],
      }),
    );

    expect(await f.owner.equityConvertible.findFirstOrThrow({ where: f.mine })).toMatchObject({
      sourceSafeId: null,
    });
    for (const scope of [f.sameSpace, f.otherSpace]) {
      const sourceSafe = scope.userId === f.sameSpace.userId ? sameSpaceSafe : otherSpaceSafe;
      expect(
        await f.owner.equityConvertible.findFirst({
          where: { ...scope, sourceSafeId: sourceSafe.id },
        }),
      ).toBeNull();
    }
  });
});
