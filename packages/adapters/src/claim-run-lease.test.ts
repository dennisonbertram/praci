import { describe, expect, it, vi } from "vitest";
import { claimRunLease } from "./executor.js";

describe("claimRunLease", () => {
  it("only a first claim that still sees fence 0 can set the fragment record", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = { run: { updateMany } } as never;
    const run = { id: "r1", status: "queued", checkpoint: null };
    await claimRunLease(prisma, run, "w", 1, new Date(), true);
    const call = updateMany.mock.calls[0] as unknown as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(call[0].where.leaseFence).toBe(0);
    expect(call[0].data.fragmentRecord).toBe(true);
    // A later claim does not compare the fence or touch the flag.
    updateMany.mockClear();
    await claimRunLease(prisma, run, "w", 2, new Date(), true);
    const later = updateMany.mock.calls[0] as unknown as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(later[0].where.leaseFence).toBeUndefined();
    expect(later[0].data.fragmentRecord).toBeUndefined();
  });
});
