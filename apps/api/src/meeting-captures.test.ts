import type { Actor } from "@rakazo/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finishCapture, setMeetingRecording } from "./meeting-captures.js";

const NOW = new Date("2026-03-01T12:00:00.000Z");
const STARTED = new Date("2026-03-01T11:00:00.000Z");
const actor = { spaceId: "space-1", userId: "user-1" } as Actor;

function setup() {
  const writes: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "cap-1", status: "recording" }]),
    meetingCapture: {
      findFirst: vi.fn().mockResolvedValue({ startedAt: STARTED }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return { count: 1 };
      }),
    },
  };
  const prisma = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
  const jobs = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const deps = { prisma, jobs, artifacts: {} } as never;
  return { deps, writes, jobs };
}

describe("finishCapture endedAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const finishAt = async (endedAt: Date) => {
    const { deps, writes, jobs } = setup();
    await finishCapture(deps, actor, { captureId: "cap-1", endedAt: endedAt.toISOString() });
    expect(jobs.enqueue).toHaveBeenCalledOnce();
    expect(writes).toHaveLength(1);
    return writes[0];
  };

  it("never ends before it started", async () => {
    const data = await finishAt(new Date(STARTED.getTime() - 10 * 60_000));
    expect(data).toEqual({ status: "finishing", endedAt: STARTED });
  });

  it("never ends in the future", async () => {
    const data = await finishAt(new Date(NOW.getTime() + 2 * 3_600_000));
    expect(data).toEqual({ status: "finishing", endedAt: NOW });
  });

  it("keeps a plausible end", async () => {
    const endedAt = new Date("2026-03-01T11:30:00.000Z");
    const data = await finishAt(endedAt);
    expect(data).toEqual({ status: "finishing", endedAt });
  });
});

describe("setMeetingRecording roles", () => {
  const policySetBy = async (role: string) => {
    const update = vi.fn().mockResolvedValue({});
    // The setting runs in a serializable transaction behind the space deletion lock.
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      spaceMember: {
        findUnique: vi.fn().mockResolvedValue({ organizationId: "org-1", space: { deletingAt: null } }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ role }),
      },
      space: { update },
    };
    const prisma = { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const result = setMeetingRecording({ prisma } as never, actor, "off" as never);
    return { result, update };
  };

  it.each(["owner", "admin", "owner,admin", "member,admin"])("lets %s change it", async (role) => {
    const { result, update } = await policySetBy(role);
    await expect(result).resolves.toBeDefined();
    expect(update).toHaveBeenCalledOnce();
  });

  it.each(["member", "administrator"])("refuses %s", async (role) => {
    const { result, update } = await policySetBy(role);
    await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
  });
});
