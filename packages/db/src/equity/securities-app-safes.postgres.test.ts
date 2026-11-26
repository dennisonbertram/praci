import { EquityAppSafeListSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "../client.js";
import { EquityInputError } from "./ledger.js";
import { addEquityAppSafeToLedger, listEquityAppSafes } from "./securities-app-safes.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function barrierBeforeUnprotectedSourceSafeRead(
  prisma: PrismaClient,
  safeId: string,
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
    let locked = false;
    return new Proxy(transaction, {
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
            if (method !== "findFirst" || typeof operation !== "function") return operation;
            return async (...args: unknown[]) => {
              const result = await Reflect.apply(operation, delegate, args);
              const where = args[0] as { where?: { sourceSafeId?: unknown } } | undefined;
              if (!locked && where?.where?.sourceSafeId === safeId) await arrive();
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
type SafeSeed = {
  spaceId: string;
  userId: string;
  investorName: string;
  investorEmail?: string | null;
  amountCents: bigint;
  valuationType?: string;
  capCents?: bigint | null;
  discountPercent?: number | null;
  mfn?: boolean;
  proRata?: boolean;
  investmentDate?: Date | null;
  expiresAt?: Date | null;
  canceledAt?: Date | null;
  sentAt?: Date | null;
  signedByOwnerAt?: Date | null;
  signedByInvestorAt?: Date | null;
  paidAt?: Date | null;
};

describeEquityPostgres("equity app SAFEs (PostgreSQL)", () => {
  let f: EquityFixture;

  const createSafe = (data: SafeSeed) =>
    f.owner.safe.create({
      data: {
        ...data,
        valuationType:
          data.valuationType ?? (data.capCents == null ? "no_valuation" : "post_money_cap"),
      },
    });

  let ineligibleSafeIds: string[] = [];
  let missingDateSafeId: string;

  beforeAll(async () => {
    f = await equityFixture("app-safes");
    await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Ada Example",
      amountCents: 500_000_00n,
      capCents: 8_000_000_00n,
      valuationType: "post_money_cap",
      discountPercent: 20,
      mfn: true,
      proRata: true,
      investmentDate: day("2024-03-01"),
      paidAt: day("2024-03-02"),
    });
    await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "bob builder",
      amountCents: 250_000_00n,
      capCents: null,
      valuationType: "no_valuation",
      discountPercent: null,
      investmentDate: day("2024-01-15"),
      paidAt: day("2024-01-16"),
    });
    await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Ada Ventures",
      amountCents: 100_000_00n,
      capCents: 4_000_000_00n,
      valuationType: "pre_money_cap",
      discountPercent: 12.345678,
      investmentDate: day("2024-02-01"),
      paidAt: day("2024-02-02"),
    });
    await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Near-boundary Discount",
      amountCents: 10_000_00n,
      discountPercent: 99.999999,
      investmentDate: day("2024-01-10"),
      paidAt: day("2024-01-11"),
    });
    const missingDate = await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Date Missing",
      amountCents: 10_000_00n,
      investmentDate: null,
      paidAt: day("2024-02-20"),
    });
    missingDateSafeId = missingDate.id;
    await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Funded Before Expiry",
      amountCents: 10_000_00n,
      investmentDate: day("2024-02-15"),
      paidAt: day("2024-02-16"),
      expiresAt: day("2020-01-01"),
    });
    const lifecycleRows = await Promise.all([
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Draft SAFE",
        amountCents: 100n,
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Sent SAFE",
        amountCents: 100n,
        sentAt: day("2024-01-01"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Signed SAFE",
        amountCents: 100n,
        signedByOwnerAt: day("2024-01-01"),
        signedByInvestorAt: day("2024-01-02"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Expired SAFE",
        amountCents: 100n,
        expiresAt: day("2020-01-01"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Canceled SAFE",
        amountCents: 100n,
        paidAt: day("2024-01-01"),
        canceledAt: day("2024-01-02"),
      }),
    ]);
    ineligibleSafeIds = lifecycleRows.map((row) => row.id);
    // Another user in the same space and the same user in another space: never visible.
    await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.sameSpace.userId,
      investorName: "Ada Example",
      amountCents: 1n,
      investmentDate: day("2024-03-01"),
      paidAt: day("2024-03-02"),
    });
    await createSafe({
      spaceId: f.otherSpace.spaceId,
      userId: f.mine.userId,
      investorName: "Ada Example",
      amountCents: 1n,
      investmentDate: day("2024-03-01"),
      paidAt: day("2024-03-02"),
    });
  });

  afterAll(async () => {
    await f?.close();
  });

  it("lists and maps the actor's Fundraising SAFEs", async () => {
    const rows = await f.as(f.mine, () => listEquityAppSafes(f.prisma, f.mine, {}));
    expect(() => EquityAppSafeListSchema.parse(rows)).not.toThrow();
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.investorName)).toEqual([
      "Ada Example",
      "Funded Before Expiry",
      "Ada Ventures",
      "bob builder",
      "Near-boundary Discount",
      "Date Missing",
    ]);
    expect(rows[0]).toMatchObject({
      investorEmail: null,
      principalCents: "50000000",
      valuationCapCents: "800000000",
      valuationCapType: "post_money",
      discountPercent: "20.0000000000",
      mfn: true,
      proRata: true,
      issueDate: "2024-03-01",
    });
    expect(rows[2]).toMatchObject({
      valuationCapCents: "400000000",
      valuationCapType: "pre_money",
      discountPercent: "12.3456780000",
      issueDate: "2024-02-01",
    });
    expect(rows[3]).toMatchObject({
      valuationCapCents: null,
      valuationCapType: null,
      discountPercent: null,
      issueDate: "2024-01-15",
    });
    expect(rows[4]).toMatchObject({ discountPercent: "99.9999990000" });
    expect(rows[5]).toMatchObject({ valuationCapType: null, issueDate: null });
    expect(rows.map((row) => row.investorName)).not.toContain("Canceled SAFE");
  });

  it("searches investor names case-insensitively", async () => {
    expect(
      (await f.as(f.mine, () => listEquityAppSafes(f.prisma, f.mine, { search: "ADA V" }))).map(
        (row) => row.investorName,
      ),
    ).toEqual(["Ada Ventures"]);
    expect(
      await f.as(f.mine, () => listEquityAppSafes(f.prisma, f.mine, { search: "zzz" })),
    ).toEqual([]);
  });

  it("keeps another user and another space out", async () => {
    for (const scope of [f.sameSpace, f.otherSpace]) {
      const rows = await f.as(scope, () => listEquityAppSafes(f.prisma, scope, {}));
      // Each sees only its own 1-cent SAFE, never any of the main tenant's three.
      expect(rows.map((row) => row.principalCents)).toEqual(["1"]);
    }
  });

  it("adds a Fundraising SAFE to the ledger once and then hides it from the read-through", async () => {
    const before = await f.as(f.mine, () => listEquityAppSafes(f.prisma, f.mine, {}));
    const ada = before.find((row) => row.investorName === "Ada Example")!;
    const added = await f.as(f.mine, () =>
      addEquityAppSafeToLedger(f.prisma, f.mine, { safeId: ada.id }),
    );
    expect(added).toMatchObject({
      kind: "safe",
      principalCents: "50000000",
      stakeholderName: "Ada Example",
      valuationCapCents: "800000000",
      valuationCapType: "post_money",
      discountPercent: "20",
      mfn: true,
      proRata: true,
      issueDate: "2024-03-01",
    });
    const issue = await f.owner.equityTransaction.findFirstOrThrow({
      where: { ...f.mine, kind: "issue", convertibleId: added.id },
    });
    expect(issue.after).toMatchObject({ sourceSafeId: ada.id });
    const countsBeforeRepeat = {
      convertibles: await f.owner.equityConvertible.count({
        where: { ...f.mine, sourceSafeId: ada.id },
      }),
      transactions: await f.owner.equityTransaction.count({
        where: { ...f.mine, kind: "issue", convertibleId: added.id },
      }),
      holders: await f.owner.equityStakeholder.count({ where: { ...f.mine, name: "Ada Example" } }),
    };
    const repeated = await f.as(f.mine, () =>
      addEquityAppSafeToLedger(f.prisma, f.mine, { safeId: ada.id }),
    );
    expect(repeated.id).toBe(added.id);
    expect({
      convertibles: await f.owner.equityConvertible.count({
        where: { ...f.mine, sourceSafeId: ada.id },
      }),
      transactions: await f.owner.equityTransaction.count({
        where: { ...f.mine, kind: "issue", convertibleId: added.id },
      }),
      holders: await f.owner.equityStakeholder.count({ where: { ...f.mine, name: "Ada Example" } }),
    }).toEqual(countsBeforeRepeat);
    const after = await f.as(f.mine, () => listEquityAppSafes(f.prisma, f.mine, {}));
    expect(after.map((row) => row.id)).not.toContain(ada.id);
    expect(after).toHaveLength(before.length - 1);
    const theirs = before.find((row) => row.investorName === "Ada Example")!;
    for (const scope of [f.sameSpace, f.otherSpace]) {
      await expect(
        f.as(scope, () => addEquityAppSafeToLedger(f.prisma, scope, { safeId: theirs.id })),
      ).rejects.toThrow();
      expect(
        await f.owner.equityConvertible.count({ where: { ...scope, sourceSafeId: theirs.id } }),
      ).toBe(0);
    }
  });

  it("rejects ineligible SAFE imports and does not invent an issue date", async () => {
    for (const safeId of [...ineligibleSafeIds, missingDateSafeId])
      await expect(
        f.as(f.mine, () => addEquityAppSafeToLedger(f.prisma, f.mine, { safeId })),
      ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("validates SAFE amounts, valuation terms, and discount bounds on direct add", async () => {
    const invalid = await Promise.all([
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Zero Principal",
        amountCents: 0n,
        investmentDate: day("2024-01-01"),
        paidAt: day("2024-01-02"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Unknown Valuation",
        amountCents: 1_000n,
        valuationType: "unknown",
        capCents: 1_000n,
        investmentDate: day("2024-01-01"),
        paidAt: day("2024-01-02"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Missing Cap",
        amountCents: 1_000n,
        valuationType: "pre_money_cap",
        capCents: null,
        investmentDate: day("2024-01-01"),
        paidAt: day("2024-01-02"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Unexpected Cap",
        amountCents: 1_000n,
        valuationType: "no_valuation",
        capCents: 1_000n,
        investmentDate: day("2024-01-01"),
        paidAt: day("2024-01-02"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Negative Discount",
        amountCents: 1_000n,
        discountPercent: -1,
        investmentDate: day("2024-01-01"),
        paidAt: day("2024-01-02"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Full Discount",
        amountCents: 1_000n,
        discountPercent: 100,
        investmentDate: day("2024-01-01"),
        paidAt: day("2024-01-02"),
      }),
      createSafe({
        spaceId: f.mine.spaceId,
        userId: f.mine.userId,
        investorName: "Too Precise Discount",
        amountCents: 1_000n,
        discountPercent: 12.12345678901,
        investmentDate: day("2024-01-01"),
        paidAt: day("2024-01-02"),
      }),
    ]);
    for (const safe of invalid)
      await expect(
        f.as(f.mine, () => addEquityAppSafeToLedger(f.prisma, f.mine, { safeId: safe.id })),
      ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("rejects ambiguous holder names and uses a unique normalized email match", async () => {
    const first = await f.as(f.mine, () =>
      createEquityStakeholder(f.prisma, f.mine, {
        type: "organization",
        name: "Shared SAFE Investor",
        contactEmail: "first@example.test",
      }),
    );
    await f.as(f.mine, () =>
      createEquityStakeholder(f.prisma, f.mine, {
        type: "organization",
        name: "shared safe investor",
        contactEmail: "second@example.test",
      }),
    );
    const ambiguous = await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Shared SAFE Investor",
      amountCents: 1_000n,
      investmentDate: day("2024-01-01"),
      paidAt: day("2024-01-02"),
    });
    await expect(
      f.as(f.mine, () => addEquityAppSafeToLedger(f.prisma, f.mine, { safeId: ambiguous.id })),
    ).rejects.toBeInstanceOf(EquityInputError);

    const emailMatched = await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Shared SAFE Investor",
      investorEmail: " FIRST@example.test ",
      amountCents: 1_000n,
      investmentDate: day("2024-01-01"),
      paidAt: day("2024-01-02"),
    });
    const linked = await f.as(f.mine, () =>
      addEquityAppSafeToLedger(f.prisma, f.mine, { safeId: emailMatched.id }),
    );
    expect(linked.stakeholderId).toBe(first.id);
  });

  it("ignores merged same-name stakeholders when matching a SAFE", async () => {
    const current = await f.as(f.mine, () =>
      createEquityStakeholder(f.prisma, f.mine, {
        type: "organization",
        name: "Merged SAFE Holder",
      }),
    );
    const merged = await f.as(f.mine, () =>
      createEquityStakeholder(f.prisma, f.mine, {
        type: "organization",
        name: "Merged SAFE Holder",
      }),
    );
    await f.owner.equityStakeholder.update({
      where: { id: merged.id },
      data: { mergedIntoId: current.id },
    });
    const safe = await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Merged SAFE Holder",
      amountCents: 1_000n,
      investmentDate: day("2024-01-01"),
      paidAt: day("2024-01-02"),
    });

    const linked = await f.as(f.mine, () =>
      addEquityAppSafeToLedger(f.prisma, f.mine, { safeId: safe.id }),
    );
    expect(linked.stakeholderId).toBe(current.id);
  });

  it("rejects a sole same-name holder with a conflicting known email", async () => {
    await f.as(f.mine, () =>
      createEquityStakeholder(f.prisma, f.mine, {
        type: "organization",
        name: "Conflicting SAFE Holder",
        contactEmail: "known@example.test",
      }),
    );
    const safe = await createSafe({
      spaceId: f.mine.spaceId,
      userId: f.mine.userId,
      investorName: "Conflicting SAFE Holder",
      investorEmail: "other@example.test",
      amountCents: 1_000n,
      investmentDate: day("2024-01-01"),
      paidAt: day("2024-01-02"),
    });

    await expect(
      f.as(f.mine, () => addEquityAppSafeToLedger(f.prisma, f.mine, { safeId: safe.id })),
    ).rejects.toBeInstanceOf(EquityInputError);
    expect(
      await f.owner.equityConvertible.count({ where: { ...f.mine, sourceSafeId: safe.id } }),
    ).toBe(0);
  });

  it("returns the same ledger record to concurrent adds of one SAFE", async () => {
    const safe = await f.owner.safe.findFirstOrThrow({
      where: { ...f.mine, investorName: "Ada Ventures" },
      select: { id: true },
    });
    const interleaved = barrierBeforeUnprotectedSourceSafeRead(f.prisma, safe.id);
    const results = await Promise.allSettled([
      f.as(f.mine, () => addEquityAppSafeToLedger(interleaved, f.mine, { safeId: safe.id })),
      f.as(f.mine, () => addEquityAppSafeToLedger(interleaved, f.mine, { safeId: safe.id })),
    ]);
    const fulfilled = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    expect(fulfilled).toHaveLength(2);
    expect(fulfilled[0]!.id).toBe(fulfilled[1]!.id);
    expect(fulfilled[0]!.discountPercent).toBe("12.345678");
    expect(
      await f.owner.equityConvertible.count({ where: { ...f.mine, sourceSafeId: safe.id } }),
    ).toBe(1);
    expect(
      await f.owner.equityTransaction.count({
        where: { ...f.mine, kind: "issue", convertibleId: fulfilled[0]!.id },
      }),
    ).toBe(1);
    expect(
      await f.owner.equityStakeholder.count({ where: { ...f.mine, name: "Ada Ventures" } }),
    ).toBe(1);
  });
});
