import { afterAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { runAsTenant } from "./row-security.js";
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

  it("returns the storage keys of the deleted space's items and contact photos", async () => {
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
    await runAsTenant({ spaceId, userId }, async () => {
      await prisma.dataRoomItem.createMany({
        data: [item("a", `blob/a-${suffix}`), item("b", null)],
      });

      await prisma.contactPhoto.create({
        data: {
          spaceId,
          userId,
          email: "ann@example.test",
          storageKey: `photo/a-${suffix}`,
          source: "google",
          contentType: "image/png",
          contentHash: "h",
          fetchedAt: new Date(),
        },
      });

      const capture = await prisma.meetingCapture.create({
        data: {
          spaceId,
          userId,
          clientId: `c-${suffix}`,
          engine: "server",
          tracks: ["microphone"],
        },
      });
      await prisma.meetingCaptureChunk.createMany({
        data: [
          {
            spaceId,
            userId,
            captureId: capture.id,
            track: "microphone",
            seq: 0,
            startMs: 0,
            endMs: 1,
            sha256: "x",
            blobKey: `capture/a-${suffix}`,
          },
          {
            spaceId,
            userId,
            captureId: capture.id,
            track: "microphone",
            seq: 1,
            startMs: 1,
            endMs: 2,
            sha256: "y",
            status: "done",
          },
        ],
      });

      await prisma.computer.create({
        data: {
          spaceId,
          userId,
          scopeKey: `scope-${suffix}`,
          homeKey: `home-${suffix}`,
          kind: "docker",
          providerRef: null,
          homeSnapshotId: `snap-${suffix}`,
          homePreviousSnapshotId: `prev-${suffix}`,
        },
      });
      const connection = await prisma.connection.create({
        data: {
          spaceId,
          userId,
          provider: "omi",
          displayName: "Omi",
          status: "connected",
        },
      });
      const upload = (n: string, assembledAt: Date | null) => ({
        spaceId,
        userId,
        connectionId: connection.id,
        firstSeq: BigInt(n === "open" ? 0 : 1),
        sha256: `sha-${n}-${suffix}`,
        recordCount: 1,
        codec: 20,
        rtcValid: true,
        storageKey: `omi/${n}-${suffix}`,
        assembledAt,
      });
      await prisma.omiUpload.createMany({
        data: [upload("open", null), upload("done", new Date())],
      });

      const input = { currentSpaceId: spaceId, userId, spaceId };
      const claim = await claimEmptySpaceDeletionForMember(prisma, input);
      const result = await deleteEmptySpaceForMember(prisma, { ...input, claimId: claim.claimId });
      expect(result.dataRoomStorageKeys).toEqual([
        `blob/a-${suffix}`,
        `photo/a-${suffix}`,
        `capture/a-${suffix}`,
        `omi/open-${suffix}`,
      ]);
      expect(result.homes).toEqual([
        {
          homeKey: `home-${suffix}`,
          homeSnapshotId: `snap-${suffix}`,
          homePreviousSnapshotId: `prev-${suffix}`,
        },
      ]);
      expect(await prisma.dataRoomItem.count({ where: { spaceId } })).toBe(0);
      expect(await prisma.contactPhoto.count({ where: { spaceId } })).toBe(0);
    });
  });
});
