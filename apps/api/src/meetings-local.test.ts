import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { MeetingsDeps } from "./meetings.js";
import { disconnectLocal } from "./meetings-local.js";

const actor = { spaceId: "space-1", userId: "user-1" } as Actor;

function setup(deleteMeeting: () => Promise<unknown>, rows = [{ id: "gone" }, { id: "kept" }]) {
  const deleted: unknown[] = [];
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "kept" }]),
    inboxTodo: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    meetingTombstone: { upsert: vi.fn().mockResolvedValue({}) },
    meeting: {
      delete: vi.fn(async (arg: unknown) => {
        deleted.push(arg);
        return deleteMeeting();
      }),
    },
    dataRoomItem: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    connection: {
      findFirst: vi.fn().mockResolvedValue({ id: "conn-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    meeting: {
      findMany: vi.fn().mockResolvedValue(rows),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "gone" ? null : { provider: "hex", externalId: "x" },
      ),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const deps = { router: { prisma } } as unknown as MeetingsDeps;
  return { deps, deleted };
}

const input = { connectionId: "conn-1", deleteMeetings: true };

describe("disconnectLocal", () => {
  it("skips a meeting that vanished and still deletes the rest", async () => {
    const { deps, deleted } = setup(async () => undefined);
    await expect(disconnectLocal(deps, actor, input)).resolves.toEqual({ ok: true });
    expect(deleted).toEqual([{ where: { id: "kept" } }]);
  });

  it("surfaces other delete failures", async () => {
    const { deps } = setup(async () => {
      throw new Error("db down");
    }, [{ id: "kept" }]);
    await expect(disconnectLocal(deps, actor, input)).rejects.toThrow("db down");
  });
});
