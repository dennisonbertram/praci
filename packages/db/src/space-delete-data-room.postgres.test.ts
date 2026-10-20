import { afterAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { claimEmptySpaceDeletionForMember, deleteEmptySpaceForMember } from "./spaces.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("space deletion and Data room blobs (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `sddr-user-${suffix}`;
  const organizationId = `sddr-org-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("returns the storage keys of the deleted space's items", async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    const createdAt = new Date();
    await prisma.user.create({
      data: { id: userId, name: "U", email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "O", slug: organizationId, createdAt },
    });
    await prisma.space.create({
      data: {
        id: `${organizationId}-home`,
        organizationId,
        name: "Home",
        isDefault: true,
        createdByUserId: userId,
      },
    });
    await prisma.member.create({
      data: { id: `sddr-member-${suffix}`, organizationId, userId, role: "owner", createdAt },
    });
    const spaceId = `${organizationId}-extra`;
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "Extra", createdByUserId: userId },
    });
    await prisma.spaceMember.create({
      data: { id: `sddr-sm-${suffix}`, spaceId, organizationId, userId, role: "owner", createdAt },
    });
    const item = (n: string, storageKey: string | null) => ({
      spaceId,
      userId,
      source: storageKey ? "upload" : "drive",
      sha256: `sha-${n}-${suffix}`,
      storageKey,
      name: n,
      mimeType: "text/plain",
      size: 1,
    });
    await prisma.dataRoomItem.createMany({
      data: [item("a", `blob/a-${suffix}`), item("b", null)],
    });

    const input = { currentSpaceId: spaceId, userId, spaceId };
    const claim = await claimEmptySpaceDeletionForMember(prisma, input);
    const result = await deleteEmptySpaceForMember(prisma, { ...input, claimId: claim.claimId });
    expect(result.dataRoomStorageKeys).toEqual([`blob/a-${suffix}`]);
    expect(await prisma.dataRoomItem.count({ where: { spaceId } })).toBe(0);
  });
});
