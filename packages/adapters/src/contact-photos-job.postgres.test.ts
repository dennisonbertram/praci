import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  BackgroundJob,
  ContactPhotoRef,
  ContactPhotoSource,
  JobPublisher,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkPhoto,
  deleteContactPhotosForConnection,
  PHOTO_MAX_BYTES,
  requestContactPhotos,
  runContactPhotosJob,
} from "./contact-photos-job.js";
import { MemoryArtifacts } from "./data-room-test-fakes.js";
import { CONTACTS_READONLY } from "./google-connector.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const PNG = (n: number, size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47]);
  bytes[8] = n;
  return bytes;
};
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe("checkPhoto", () => {
  it("accepts the three image types and refuses everything else", () => {
    expect(checkPhoto({ bytes: PNG(1), contentType: "image/png" })).toBe("image/png");
    expect(checkPhoto({ bytes: JPEG, contentType: "image/jpeg" })).toBe("image/jpeg");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(checkPhoto({ bytes: webp, contentType: "image/webp" })).toBe("image/webp");
    expect(checkPhoto({ bytes: PNG(1), contentType: "image/svg+xml" })).toBeNull();
    expect(checkPhoto({ bytes: PNG(1), contentType: "image/jpeg" })).toBeNull();
    expect(
      checkPhoto({ bytes: new TextEncoder().encode("<svg/>"), contentType: "image/png" }),
    ).toBeNull();
    expect(checkPhoto({ bytes: PNG(1, PHOTO_MAX_BYTES + 1), contentType: "image/png" })).toBeNull();
  });
});

describePostgres("contacts.photos job (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const owner = { userId: `cp-a-${run}`, spaceId: `cp-space-a-${run}` };
  const other = { userId: `cp-b-${run}`, spaceId: `cp-space-b-${run}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const artifacts = new MemoryArtifacts();

  const sourceOf = (
    refs: ContactPhotoRef[],
    images: Record<string, { bytes: Uint8Array; contentType: string } | null>,
  ) => {
    const counts = { lists: 0, downloads: 0 };
    const source: ContactPhotoSource = {
      async *list() {
        counts.lists++;
        yield* refs;
      },
      async download(url) {
        counts.downloads++;
        return images[url] ?? null;
      },
    };
    return { source, counts };
  };

  async function connect(who: typeof owner, scope: string | undefined) {
    return prisma.connection.create({
      data: {
        ...who,
        connectorId: "google",
        provider: "gmail",
        displayName: "me",
        status: "connected",
        providerRef: `sub-${randomUUID()}`,
        metadata: scope === undefined ? {} : { scope },
      },
    });
  }
  const photosOf = (who: typeof owner) => prisma.contactPhoto.findMany({ where: who });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const who of [owner, other]) {
      const orgId = `org-${who.spaceId}`;
      await prisma.user.create({
        data: { id: who.userId, name: who.userId, email: `${who.userId}@rakazo.test` },
      });
      await prisma.organization.create({
        data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: who.spaceId, organizationId: orgId, name: who.spaceId, isDefault: true },
      });
      await prisma.member.create({
        data: {
          id: `m-${who.userId}`,
          organizationId: orgId,
          userId: who.userId,
          role: "owner",
          createdAt: new Date(),
        },
      });
    }
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({
      where: { id: { in: [owner, other].map((who) => `org-${who.spaceId}`) } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [owner.userId, other.userId] } } });
    await close();
  });

  it("stores photos for the user and space, once per address, and a rerun changes nothing", async () => {
    const conn = await connect(owner, `openid ${CONTACTS_READONLY}`);
    const { source, counts } = sourceOf(
      [
        { emails: ["ann@example.test", "ann@work.test"], url: "u1" },
        { emails: ["bo@example.test"], url: "u2" },
      ],
      {
        u1: { bytes: PNG(1), contentType: "image/png" },
        u2: { bytes: JPEG, contentType: "image/jpeg" },
      },
    );
    const payload = { ...owner, connectionId: conn.id };
    const at = new Date("2026-10-26T12:00:00Z");
    await runContactPhotosJob({ prisma, artifacts, source, now: () => at }, payload);
    const rows = await photosOf(owner);
    expect(rows.map((r) => r.email).sort()).toEqual([
      "ann@example.test",
      "ann@work.test",
      "bo@example.test",
    ]);
    expect(rows.every((r) => r.source === "google")).toBe(true);
    expect(await photosOf(other)).toEqual([]);
    const blobsBefore = artifacts.blobs.size;

    // Within a day: nothing is fetched at all.
    await runContactPhotosJob(
      { prisma, artifacts, source, now: () => new Date(at.getTime() + 3_600_000) },
      payload,
    );
    expect(counts.lists).toBe(1);

    // After a day, unchanged photos are neither stored again nor duplicated.
    await runContactPhotosJob(
      { prisma, artifacts, source, now: () => new Date(at.getTime() + 25 * 3_600_000) },
      payload,
    );
    expect(counts.lists).toBe(2);
    expect(artifacts.blobs.size).toBe(blobsBefore);
    expect(await photosOf(owner)).toHaveLength(3);
  });

  it("replaces and deletes the old blob when a photo changes", async () => {
    const conn = await connect(owner, CONTACTS_READONLY);
    const payload = { ...owner, connectionId: conn.id };
    const first = sourceOf([{ emails: ["chg@example.test"], url: "u" }], {
      u: { bytes: PNG(7), contentType: "image/png" },
    });
    await runContactPhotosJob(
      { prisma, artifacts, source: first.source, now: () => new Date("2026-10-01T00:00:00Z") },
      payload,
    );
    const before = await prisma.contactPhoto.findFirstOrThrow({
      where: { ...owner, email: "chg@example.test" },
    });
    const second = sourceOf([{ emails: ["chg@example.test"], url: "u" }], {
      u: { bytes: PNG(8), contentType: "image/png" },
    });
    await runContactPhotosJob(
      { prisma, artifacts, source: second.source, now: () => new Date("2026-10-03T00:00:00Z") },
      payload,
    );
    const after = await prisma.contactPhoto.findFirstOrThrow({
      where: { ...owner, email: "chg@example.test" },
    });
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(artifacts.blobs.has(before.storageKey)).toBe(false);
    expect(artifacts.blobs.has(after.storageKey)).toBe(true);
  });

  it("skips accounts without a contacts scope, silently", async () => {
    const old = await connect(owner, "openid email https://www.googleapis.com/auth/gmail.readonly");
    const none = await connect(owner, undefined);
    const { source, counts } = sourceOf([{ emails: ["skip@example.test"], url: "u" }], {
      u: { bytes: PNG(1), contentType: "image/png" },
    });
    for (const conn of [old, none])
      await runContactPhotosJob({ prisma, artifacts, source }, { ...owner, connectionId: conn.id });
    expect(counts.lists).toBe(0);
    const queued: BackgroundJob[] = [];
    const jobs = { enqueue: async (job: BackgroundJob) => void queued.push(job) } as JobPublisher;
    const granted = await connect(other, CONTACTS_READONLY);
    await requestContactPhotos({ prisma, jobs }, other);
    await requestContactPhotos({ prisma, jobs }, { ...owner, userId: "nobody" });
    expect(queued.map((job) => (job.payload as { connectionId: string }).connectionId)).toEqual([
      granted.id,
    ]);
  });

  it("refuses to run for a connection that is not the user's", async () => {
    const conn = await connect(other, CONTACTS_READONLY);
    const { source, counts } = sourceOf([], {});
    await runContactPhotosJob({ prisma, artifacts, source }, { ...owner, connectionId: conn.id });
    expect(counts.lists).toBe(0);
  });

  it("drops images of the wrong type, the wrong bytes or over the size cap", async () => {
    const conn = await connect(owner, CONTACTS_READONLY);
    const svg = new TextEncoder().encode("<svg onload=alert(1)/>");
    const { source } = sourceOf(
      [
        { emails: ["svg@example.test"], url: "svg" },
        { emails: ["big@example.test"], url: "big" },
        { emails: ["lie@example.test"], url: "lie" },
        { emails: ["null@example.test"], url: "null" },
        { emails: ["good@example.test"], url: "good" },
      ],
      {
        svg: { bytes: svg, contentType: "image/svg+xml" },
        big: { bytes: PNG(1, PHOTO_MAX_BYTES + 1), contentType: "image/png" },
        lie: { bytes: svg, contentType: "image/png" },
        good: { bytes: PNG(3), contentType: "image/png" },
      },
    );
    await runContactPhotosJob({ prisma, artifacts, source }, { ...owner, connectionId: conn.id });
    const emails = (await photosOf(owner)).map((r) => r.email);
    expect(emails).toContain("good@example.test");
    for (const bad of ["svg", "big", "lie", "null"])
      expect(emails).not.toContain(`${bad}@example.test`);
  });

  it("prunes a photo the account no longer lists or that became a placeholder, and its blob", async () => {
    const solo = { userId: other.userId, spaceId: other.spaceId };
    // Pruning only runs when no other Google login could own the rows.
    await prisma.connection.updateMany({ where: solo, data: { status: "revoked" } });
    const conn = await connect(solo, CONTACTS_READONLY);
    const payload = { ...solo, connectionId: conn.id };
    const image = {
      u1: { bytes: PNG(21), contentType: "image/png" },
      u2: { bytes: PNG(22), contentType: "image/png" },
    };
    const first = sourceOf(
      [
        { emails: ["keep@example.test"], url: "u1" },
        { emails: ["gone@example.test"], url: "u2" },
      ],
      image,
    );
    await runContactPhotosJob(
      { prisma, artifacts, source: first.source, now: () => new Date("2026-10-01T00:00:00Z") },
      payload,
    );
    const gone = await prisma.contactPhoto.findFirstOrThrow({
      where: { ...solo, email: "gone@example.test" },
    });
    // The second listing no longer includes the address (removed, or now Google's placeholder).
    const second = sourceOf([{ emails: ["keep@example.test"], url: "u1" }], image);
    await runContactPhotosJob(
      { prisma, artifacts, source: second.source, now: () => new Date("2026-10-03T00:00:00Z") },
      payload,
    );
    expect((await photosOf(solo)).map((r) => r.email)).toEqual(["keep@example.test"]);
    expect(artifacts.blobs.has(gone.storageKey)).toBe(false);
  });

  it("does not prune when the listing fails part way", async () => {
    const solo = { userId: other.userId, spaceId: other.spaceId };
    const before = await photosOf(solo);
    expect(before.length).toBeGreaterThan(0);
    const conn = await connect(solo, CONTACTS_READONLY);
    const broken: ContactPhotoSource = {
      list: () => ({
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            throw new Error("People API down");
          },
        }),
      }),
      download: async () => null,
    };
    await expect(
      runContactPhotosJob(
        { prisma, artifacts, source: broken, now: () => new Date("2026-11-01T00:00:00Z") },
        { ...solo, connectionId: conn.id },
      ),
    ).rejects.toThrow();
    expect(await photosOf(solo)).toHaveLength(before.length);
  });

  it("revoking the only Google login returns the photo keys and removes the rows", async () => {
    const lone = { userId: `${owner.userId}`, spaceId: owner.spaceId };
    const rowsBefore = await photosOf(lone);
    expect(rowsBefore.length).toBeGreaterThan(0);
    const all = await prisma.connection.findMany({ where: { ...lone, connectorId: "google" } });
    // Keep one scoped login connected and revoke the others: photos stay.
    const [keep, ...rest] = all.filter((c) => (c.metadata as { scope?: string }).scope);
    await prisma.connection.updateMany({
      where: { id: { in: all.filter((c) => c.id !== keep?.id).map((c) => c.id) } },
      data: { status: "revoked" },
    });
    const stays = await prisma.$transaction((tx) =>
      deleteContactPhotosForConnection(tx, { ...lone, connectionId: (rest[0] ?? all[0])!.id }),
    );
    expect(stays).toEqual([]);
    expect(await photosOf(lone)).toHaveLength(rowsBefore.length);
    // Now the last scoped login goes.
    await prisma.connection.update({ where: { id: keep!.id }, data: { status: "revoked" } });
    const keys = await prisma.$transaction((tx) =>
      deleteContactPhotosForConnection(tx, { ...lone, connectionId: keep!.id }),
    );
    expect(keys.sort()).toEqual(rowsBefore.map((r) => r.storageKey).sort());
    expect(await photosOf(lone)).toEqual([]);
    expect(await prisma.contactPhotoSync.count({ where: { connectionId: keep!.id } })).toBe(0);
  });
});
