import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDataRoomRepos } from "./data-room.js";

const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@example.com",
  isDeploymentOwner: false,
};

function fakePrisma(item: Record<string, unknown> | null = {}) {
  const dataRoomItem = {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    groupBy: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(item),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const dataRoomImport = {
    update: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
  };
  const prisma = { dataRoomItem, dataRoomImport } as unknown as PrismaClient;
  return { prisma, dataRoomItem, dataRoomImport };
}

describe("processing", () => {
  it("fails only extracting items that are stale, scoped to the actor", async () => {
    const { prisma, dataRoomItem } = fakePrisma(null);
    await createDataRoomRepos(prisma).processing(actor, new Date("2026-01-01T12:00:00Z"));
    const args = dataRoomItem.updateMany.mock.calls[0]?.[0];
    expect(args.where).toMatchObject({ spaceId: "space-1", userId: "user-1" });
    expect(JSON.stringify(args.where.status)).not.toContain("pending");
    expect(args.where.status).toBe("extracting");
    expect(args.where.updatedAt.lt).toEqual(new Date("2026-01-01T11:45:00Z"));
    expect(args.data).toEqual({ status: "failed", error: "Reading took too long." });
  });
});

describe("deleteItem import bookkeeping", () => {
  const run = async (item: Record<string, unknown>) => {
    const fake = fakePrisma({ id: "i1", storageKey: "k", ...item });
    const result = await createDataRoomRepos(fake.prisma).deleteItem(actor, "i1");
    return { ...fake, result };
  };

  it("counts a deleted pending item of an import as a duplicate", async () => {
    const { dataRoomImport, result } = await run({ status: "pending", importId: "imp" });
    expect(result).toEqual({ storageKey: "k" });
    expect(dataRoomImport.update).toHaveBeenCalledWith({
      where: { id: "imp" },
      data: { duplicates: { increment: 1 }, rejected: { increment: 0 } },
    });
  });

  it("counts a deleted failed item of an import as rejected", async () => {
    const { dataRoomImport } = await run({ status: "failed", importId: "imp" });
    expect(dataRoomImport.update).toHaveBeenCalledWith({
      where: { id: "imp" },
      data: { duplicates: { increment: 0 }, rejected: { increment: 1 } },
    });
  });

  it("writes nothing to imports when the item has no import", async () => {
    const { dataRoomImport } = await run({ status: "pending", importId: null });
    expect(dataRoomImport.update).not.toHaveBeenCalled();
  });

  it("throws and writes nothing when nothing was deleted", async () => {
    const fake = fakePrisma({ id: "i1", storageKey: "k", status: "pending", importId: "imp" });
    fake.dataRoomItem.deleteMany.mockResolvedValue({ count: 0 });
    await expect(createDataRoomRepos(fake.prisma).deleteItem(actor, "i1")).rejects.toThrow();
    expect(fake.dataRoomImport.update).not.toHaveBeenCalled();
  });
});
