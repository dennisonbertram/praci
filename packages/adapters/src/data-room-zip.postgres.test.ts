import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFileDataRoomItem } from "./data-room-files.js";
import { MemoryArtifacts, RecordingJobs } from "./data-room-test-fakes.js";
import { ZipRefusal } from "./zip-unpack.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const text = (value: string) => new TextEncoder().encode(value);

describePostgres("Data room zip unpacking (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let files: ReturnType<typeof createFileDataRoomItem>;
  let jobs: RecordingJobs;
  let owner: Actor;
  let other: Actor;
  const spaceId = `zip-space-${run}`;

  const file = (name: string, bytes: Uint8Array, over: { importId?: string } = {}) => ({
    source: "upload" as const,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    name,
    mimeType: "application/zip",
    bytes,
    folderId: null,
    ...over,
  });
  const owned = (who: Actor) => ({ spaceId: who.spaceId, userId: who.userId });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.dataRoomItem.deleteMany({ where: { spaceId } });
      await prisma.dataRoomImport.deleteMany({ where: { spaceId } });
      await prisma.dataRoomFolder.deleteMany({ where: { spaceId } });
      await prisma.space.deleteMany({ where: { id: spaceId } });
      await prisma.organization.deleteMany({ where: { id: spaceId } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.userId, other.userId] } } });
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.organization.create({
      data: { id: spaceId, name: "zip", slug: spaceId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: spaceId, name: "zip", isDefault: true },
    });
    const user = async (label: string): Promise<Actor> => {
      const userId = `zip-user-${label}-${run}`;
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      return { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    };
    owner = await user("owner");
    other = await user("other");
    jobs = new RecordingJobs();
    files = createFileDataRoomItem(
      { prisma, artifacts: new MemoryArtifacts(), jobs },
      createDataRoomRepos(prisma),
    );
  });
  afterAll(async () => close?.());

  it("files one item per file, in the zip's folders, for the owner only", async () => {
    const inner = zipSync({ "in.txt": text("inside") });
    const zip = zipSync({
      "readme.txt": text("top"),
      "contracts/nda.md": text("# nda"),
      "contracts/2026/lease.txt": text("lease"),
      "nested.zip": inner,
      "__MACOSX/._readme.txt": text("meta"),
      ".DS_Store": text("meta"),
    });
    const { item, created } = await files.fileItem(owner, file("bundle.zip", zip));
    expect(created).toBe(true);

    const items = await prisma.dataRoomItem.findMany({
      where: owned(owner),
      include: { folder: true },
    });
    expect(items.map((i) => i.name).sort()).toEqual([
      "lease.txt",
      "nda.md",
      "nested.zip",
      "readme.txt",
    ]);
    expect(items.some((i) => i.name === "bundle.zip")).toBe(false);
    expect(items.every((i) => i.source === "upload" && i.status === "pending")).toBe(true);
    const lease = items.find((i) => i.name === "lease.txt");
    const parent = await prisma.dataRoomFolder.findFirst({ where: { id: lease?.folderId ?? "" } });
    expect([parent?.name, items.find((i) => i.name === "nda.md")?.folder?.name]).toEqual([
      "2026",
      "contracts",
    ]);
    expect(items.find((i) => i.name === "readme.txt")?.folderId).toBeNull();
    // The nested zip is a plain file of its own, not unpacked.
    expect(items.find((i) => i.name === "nested.zip")?.size).toBe(inner.length);
    expect(items.some((i) => i.name === "in.txt")).toBe(false);
    expect(items.map((i) => i.id)).toContain(item.id);

    // Ingest was queued for each item, and none of it is visible to another user.
    expect(jobs.all.filter((j) => JSON.stringify(j).includes("dataroom.ingest"))).toHaveLength(4);
    expect(await prisma.dataRoomItem.count({ where: owned(other) })).toBe(0);
    expect(await prisma.dataRoomFolder.count({ where: owned(other) })).toBe(0);

    // The import row backs "Importing X of N".
    const imp = await prisma.dataRoomImport.findFirst({ where: owned(owner) });
    expect(imp).toMatchObject({ source: "upload", total: 4, duplicates: 0, rejected: 0 });

    // The same zip again files nothing new.
    const again = await files.fileItem(owner, file("bundle.zip", zip));
    expect(again.created).toBe(false);
    expect(await prisma.dataRoomItem.count({ where: owned(owner) })).toBe(4);
  });

  it("adds to the caller's import and folder when it has them", async () => {
    const folder = await createDataRoomRepos(prisma).createFolder(owner, { name: "Inbox" });
    const imp = await prisma.dataRoomImport.create({
      data: { ...owned(owner), source: "gmail", total: 1 },
    });
    const zip = zipSync({ "x/one.txt": text("1"), "two.txt": text("2") });
    await files.fileItem(owner, {
      ...file("mail.zip", zip, { importId: imp.id }),
      source: "gmail",
      folderId: folder.id,
      externalId: "gmail:m1:a1",
    });
    expect((await prisma.dataRoomImport.findUnique({ where: { id: imp.id } }))?.total).toBe(2);
    const two = await prisma.dataRoomItem.findFirst({
      where: { ...owned(owner), name: "two.txt" },
    });
    expect([two?.folderId, two?.importId, two?.externalId]).toEqual([
      folder.id,
      imp.id,
      "gmail:m1:a1#two.txt",
    ]);
    const one = await prisma.dataRoomItem.findFirst({
      where: { ...owned(owner), name: "one.txt" },
    });
    const sub = await prisma.dataRoomFolder.findFirst({ where: { id: one?.folderId ?? "" } });
    expect([sub?.name, sub?.parentId]).toEqual(["x", folder.id]);
  });

  it("refuses an unsafe zip before filing anything", async () => {
    const before = await prisma.dataRoomItem.count({ where: owned(owner) });
    await expect(
      files.fileItem(owner, file("bad.zip", zipSync({ "../evil.txt": text("x") }))),
    ).rejects.toBeInstanceOf(ZipRefusal);
    expect(await prisma.dataRoomItem.count({ where: owned(owner) })).toBe(before);
  });
});
