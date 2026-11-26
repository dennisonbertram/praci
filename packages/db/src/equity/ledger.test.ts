import { describe, expect, it, vi } from "vitest";
import {
  fromBig,
  fromBigOrNull,
  lockEquityCertificates,
  lockEquityLabelPrefix,
  lockEquityLedger,
  nextLabel,
  toBig,
  toBigOrNull,
} from "./ledger.js";

const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;
const POSTGRES_BIGINT_MIN = -9_223_372_036_854_775_808n;

describe("equity ledger wire primitives", () => {
  it("accepts values at the signed PostgreSQL BIGINT boundaries", () => {
    expect(toBig(POSTGRES_BIGINT_MAX.toString())).toBe(POSTGRES_BIGINT_MAX);
    expect(toBig(POSTGRES_BIGINT_MIN.toString())).toBe(POSTGRES_BIGINT_MIN);
    expect(fromBig(POSTGRES_BIGINT_MAX)).toBe(POSTGRES_BIGINT_MAX.toString());
    expect(toBigOrNull(null)).toBeNull();
    expect(toBigOrNull(undefined)).toBeUndefined();
    expect(fromBigOrNull(null)).toBeNull();
  });

  it("rejects values outside the signed PostgreSQL BIGINT range", () => {
    expect(() => toBig((POSTGRES_BIGINT_MAX + 1n).toString())).toThrow();
    expect(() => toBig((POSTGRES_BIGINT_MIN - 1n).toString())).toThrow();
    expect(() => fromBig(POSTGRES_BIGINT_MAX + 1n)).toThrow();
    expect(() => toBigOrNull((POSTGRES_BIGINT_MAX + 1n).toString())).toThrow();
    expect(() => fromBigOrNull(POSTGRES_BIGINT_MAX + 1n)).toThrow();
  });

  it("increments digit-only manual labels with BigInt precision", async () => {
    const findMany = vi.fn().mockResolvedValue([{ label: "CS-9007199254740992" }]);
    const db = {
      equityCertificate: { findMany },
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    };

    await expect(
      nextLabel(db as never, { spaceId: "space", userId: "user" }, "equityCertificate", "CS"),
    ).resolves.toBe("CS-9007199254740993");
  });

  it("locks distinct rows in deterministic tenant-scoped order", async () => {
    const query = vi.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const tx = { $queryRawUnsafe: query };

    await lockEquityCertificates(tx as never, { spaceId: "space", userId: "user" }, [
      "b",
      "a",
      "b",
    ]);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY "id" FOR UPDATE'),
      "space",
      "user",
      ["a", "b"],
    );
  });

  it("skips empty lock sets and rejects a row outside the scoped set", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const tx = { $queryRawUnsafe: query };
    const scope = { spaceId: "space", userId: "user" };

    await expect(lockEquityCertificates(tx as never, scope, [])).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
    await expect(lockEquityCertificates(tx as never, scope, ["missing"])).rejects.toThrow(
      "Certificate not found",
    );
  });

  it("rejects root Prisma clients instead of auto-committing locks", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const prismaClient = { $transaction: vi.fn(), $connect: vi.fn(), $queryRawUnsafe: query };
    const scope = { spaceId: "space", userId: "user" };

    await expect(lockEquityLedger(prismaClient as never, scope)).rejects.toThrow(
      "interactive transaction",
    );
    await expect(lockEquityCertificates(prismaClient as never, scope, [])).rejects.toThrow(
      "interactive transaction",
    );
    await expect(
      lockEquityLabelPrefix(prismaClient as never, scope, "equityCertificate", "CS"),
    ).rejects.toThrow("interactive transaction");
    expect(query).not.toHaveBeenCalled();
  });
});
