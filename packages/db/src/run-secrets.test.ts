import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./client.js";
import { clearEndedRunState } from "./run-secrets.js";

describe("clearEndedRunState", () => {
  it("drops each ended run's waiting one-time answer under its own user and space", async () => {
    const prisma = {
      run: {
        findMany: vi.fn(async () => [
          { id: "run-1", userId: "user-1", spaceId: "space-1" },
          { id: "run-2", userId: "user-2", spaceId: "space-1" },
        ]),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 2 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    };
    await clearEndedRunState(prisma as unknown as PrismaClient, ["run-1", "run-2"]);
    expect(prisma.secret.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "user-1", spaceId: "space-1", kind: "run-secret:run-1" },
          { userId: "user-2", spaceId: "space-1", kind: "run-secret:run-2" },
        ],
      },
    });
  });

  it("deletes desktop app snapshot rows scoped by run, space and user", async () => {
    const prisma = {
      run: { findMany: vi.fn(async () => [{ id: "run-1", userId: "user-1", spaceId: "space-1" }]) },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    };
    await clearEndedRunState(prisma as unknown as PrismaClient, ["run-1"]);
    expect(prisma.appControlSnapshot.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ runId: "run-1", spaceId: "space-1", userId: "user-1" }] },
    });
  });

  it("does nothing without runs", async () => {
    const prisma = { run: { findMany: vi.fn() }, secret: { deleteMany: vi.fn() } };
    await clearEndedRunState(prisma as unknown as PrismaClient, []);
    expect(prisma.run.findMany).not.toHaveBeenCalled();
    expect(prisma.secret.deleteMany).not.toHaveBeenCalled();
  });
});
