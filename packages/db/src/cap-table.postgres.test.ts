import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CapTableSourceError,
  changeCapTableSource,
  getCapTableSnapshot,
  saveCapTableSnapshot,
  undoCapTableSource,
} from "./cap-table.js";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const input = {
  companyName: "Example Co",
  asOf: "2026-01-31",
  fullyDilutedShares: 1000,
  shareClasses: [{ name: "Common", shares: 1000, percent: 100 }],
  holders: [{ name: "Ada Fund", security: "Common", shares: 1000 }],
};

describePostgres("cap table snapshot (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `cap-org-${suffix}`;
  const mine = { spaceId: `cap-space-a-${suffix}`, userId: `cap-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `cap-user-b-${suffix}` };
  const otherSpace = { spaceId: `cap-space-b-${suffix}`, userId: mine.userId };
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [mine.userId, sameSpace.userId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Cap Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({ id, organizationId, name: id })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, sameSpace.userId] } } });
    await close();
  });

  it("saves, replaces, and reads back with nulls filled in", async () => {
    expect(await getCapTableSnapshot(prisma, mine)).toBeNull();
    await saveCapTableSnapshot(prisma, mine, input);
    await saveCapTableSnapshot(prisma, mine, { ...input, fullyDilutedShares: 2000 });
    const snapshot = await getCapTableSnapshot(prisma, mine);
    expect(snapshot?.fullyDilutedShares).toBe(2000);
    expect(snapshot?.amountRaisedUsd).toBeNull();
    expect(snapshot?.holders[0]?.email).toBeNull();
    expect(await prisma.capTableSnapshot.count({ where: mine })).toBe(1);
  });

  it("keeps each user and space separate", async () => {
    expect(await getCapTableSnapshot(prisma, sameSpace)).toBeNull();
    expect(await getCapTableSnapshot(prisma, otherSpace)).toBeNull();
  });

  it("rejects invalid figures without touching the stored snapshot", async () => {
    await expect(
      saveCapTableSnapshot(prisma, mine, { ...input, fullyDilutedShares: -5 }),
    ).rejects.toThrow();
    await expect(
      saveCapTableSnapshot(prisma, mine, { ...input, asOf: "last week" }),
    ).rejects.toThrow();
    expect((await getCapTableSnapshot(prisma, mine))?.fullyDilutedShares).toBe(2000);
  });

  describe("sources", () => {
    const owner = { spaceId: mine.spaceId, userId: sameSpace.userId };
    const typed = { ...input, source: "native" as const, companyName: "Typed Co" };

    it("reads old rows as carta", async () => {
      await prisma.$executeRaw`DELETE FROM cap_table_snapshots WHERE "userId" = ${owner.userId}`;
      await prisma.capTableSnapshot.create({ data: { ...owner, data: input } });
      const snapshot = await getCapTableSnapshot(prisma, owner);
      expect(snapshot?.source).toBe("carta");
      expect(snapshot?.canUndo).toBe(false);
    });

    it("refuses a write that expects another source than the row's", async () => {
      await changeCapTableSource(prisma, owner, { source: "native", companyName: "Typed Co" });
      await expect(saveCapTableSnapshot(prisma, owner, input)).rejects.toBeInstanceOf(
        CapTableSourceError,
      );
      await expect(
        saveCapTableSnapshot(prisma, owner, { ...input, source: "sheet" }),
      ).rejects.toBeInstanceOf(CapTableSourceError);
      expect((await getCapTableSnapshot(prisma, owner))?.source).toBe("native");
    });

    it("refuses a stale whole-table save and accepts a current one", async () => {
      const loaded = (await getCapTableSnapshot(prisma, owner))!;
      await saveCapTableSnapshot(prisma, owner, typed, { loadedAt: loaded.updatedAt });
      await expect(
        saveCapTableSnapshot(prisma, owner, typed, { loadedAt: loaded.updatedAt }),
      ).rejects.toBeInstanceOf(CapTableSourceError);
    });

    it("Undo after a switch returns the typed rows once", async () => {
      await saveCapTableSnapshot(prisma, owner, {
        ...typed,
        holders: [{ name: "Typed Holder", security: "Common", shares: 1000 }],
      });
      await changeCapTableSource(prisma, owner, { source: "carta", companyName: "Typed Co" });
      const switched = (await getCapTableSnapshot(prisma, owner))!;
      expect(switched.source).toBe("carta");
      expect(switched.canUndo).toBe(true);
      // The late write from the source that was left is refused.
      await expect(saveCapTableSnapshot(prisma, owner, typed)).rejects.toBeInstanceOf(
        CapTableSourceError,
      );
      expect(await undoCapTableSource(prisma, owner)).toBe(true);
      const undone = (await getCapTableSnapshot(prisma, owner))!;
      expect(undone.source).toBe("native");
      expect(undone.holders[0]?.name).toBe("Typed Holder");
      expect(undone.canUndo).toBe(false);
      expect(await undoCapTableSource(prisma, owner)).toBe(false);
    });

    it("a late sheet write after a switch back is refused, and the next change clears Undo", async () => {
      await changeCapTableSource(prisma, owner, {
        source: "sheet",
        sourceRef: { driveFileId: "file-1", name: "Cap table" },
        companyName: "Typed Co",
      });
      await changeCapTableSource(prisma, owner, { source: "native", companyName: "Typed Co" });
      await expect(
        saveCapTableSnapshot(prisma, owner, { ...typed, source: "sheet" }),
      ).rejects.toBeInstanceOf(CapTableSourceError);
      await saveCapTableSnapshot(prisma, owner, typed);
      expect((await getCapTableSnapshot(prisma, owner))?.canUndo).toBe(false);
    });

    it("creates an empty typed-in table when there is none, and keeps spaces apart", async () => {
      await changeCapTableSource(prisma, otherSpace, { source: "native", companyName: "Other Co" });
      const created = await getCapTableSnapshot(prisma, otherSpace);
      expect(created?.holders).toEqual([]);
      expect(created?.companyName).toBe("Other Co");
      expect((await getCapTableSnapshot(prisma, mine))?.companyName).not.toBe("Other Co");
    });
  });
});
