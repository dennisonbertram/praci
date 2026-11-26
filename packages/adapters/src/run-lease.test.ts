import type { PrismaClient } from "@rakazo/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renewComputerExecutionLease } from "./computer-lifecycle.js";
import { RUN_LEASE_MS, RUN_RENEW_DEADLINE_MS, startLeaseWatchdog } from "./executor.js";
import { mailSendNotDispatched } from "./mail-tools.js";

afterEach(() => vi.useRealTimers());

describe("startLeaseWatchdog", () => {
  const options = { intervalMs: 30_000, deadlineMs: 60_000 };

  it("stops the run locally when a renewal hangs past the deadline", async () => {
    vi.useFakeTimers();
    const onLost = vi.fn();
    startLeaseWatchdog(() => new Promise<boolean>(() => {}), onLost, options);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(onLost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onLost).toHaveBeenCalledOnce();
  });

  it("keeps going while renewals succeed, and stops on a refusal", async () => {
    vi.useFakeTimers();
    const onLost = vi.fn();
    let ok = true;
    startLeaseWatchdog(async () => ok, onLost, options);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(onLost).not.toHaveBeenCalled();
    ok = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onLost).toHaveBeenCalledOnce();
  });

  it("gives up before the lease lapses", () => {
    expect(RUN_RENEW_DEADLINE_MS).toBeLessThan(RUN_LEASE_MS);
  });
});

describe("computer execution lease", () => {
  it("renews for as long as the run lease", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = { computerExecutionLease: { updateMany } } as unknown as PrismaClient;
    const before = Date.now();
    await renewComputerExecutionLease(prisma, {
      computerId: "c",
      botId: "b",
      runId: "r",
      fence: 1,
    } as never);
    const { data } = (updateMany.mock.calls[0] as unknown as [{ data: { expiresAt: Date } }])[0];
    expect(data.expiresAt.getTime() - before).toBeLessThanOrEqual(RUN_LEASE_MS + 1_000);
    expect(data.expiresAt.getTime() - before).toBeGreaterThanOrEqual(RUN_LEASE_MS - 1_000);
  });
});

describe("mailSendNotDispatched", () => {
  const scope = { spaceId: "s", userId: "u" };
  const prismaWith = (state: string | null) =>
    ({
      composeSend: { findUnique: async () => (state ? { state } : null) },
    }) as unknown as PrismaClient;

  it("allows a retry only when nothing reached the provider", async () => {
    for (const [state, retry] of [
      [null, true],
      ["draft", true],
      ["failed", true],
      ["pending", false],
      ["unknown", false],
      ["sent", false],
    ] as const) {
      expect(await mailSendNotDispatched(prismaWith(state), scope, "k")).toBe(retry);
    }
  });
});
