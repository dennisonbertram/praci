import { describe, expect, it, vi } from "vitest";
import { syncBillingSnapshot } from "./billing.js";
import type { PrismaClient } from "./client.js";

function fixture(accounts: number, written: number) {
  const startedAt = new Date("2026-01-01T00:00:00Z");
  const count = vi.fn(async () => accounts);
  const updateMany = vi.fn(async () => ({ count: written }));
  const $queryRaw = vi.fn(async () => [{ startedAt }]);
  const load = vi.fn(async () => null);
  const prisma = {
    billingAccount: { count, updateMany },
    $queryRaw,
  } as unknown as PrismaClient;
  return { prisma, count, updateMany, $queryRaw, load };
}

describe("syncBillingSnapshot", () => {
  it("returns false without reading the clock or loading when no account exists", async () => {
    const f = fixture(0, 0);
    await expect(syncBillingSnapshot(f.prisma, "cus_unknown", f.load)).resolves.toBe(false);
    expect(f.count).toHaveBeenCalledWith({ where: { customerId: "cus_unknown" } });
    expect(f.load).not.toHaveBeenCalled();
    expect(f.$queryRaw).not.toHaveBeenCalled();
    expect(f.updateMany).not.toHaveBeenCalled();
  });

  it("loads and returns true for a known customer", async () => {
    const f = fixture(1, 1);
    await expect(syncBillingSnapshot(f.prisma, "cus_known", f.load)).resolves.toBe(true);
    expect(f.load).toHaveBeenCalledTimes(1);
  });

  it("returns true even when the stale-write guard skipped the write", async () => {
    const f = fixture(1, 0);
    await expect(syncBillingSnapshot(f.prisma, "cus_known", f.load)).resolves.toBe(true);
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.count).toHaveBeenCalledTimes(1);
  });
});
