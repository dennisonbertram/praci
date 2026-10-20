import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createDataRoomRepos } from "./data-room.js";
import {
  createDataRoomImport,
  listDataRoomImports,
  recordImportSkips,
  settleDataRoomImport,
} from "./data-room-imports.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("Data room imports (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let a: Actor;
  let b: Actor;
  /** Another member of space A. */
  let a2: Actor;
  const spaceIds: string[] = [];

  const files = (actor: Actor, importId: string, names: string[]) =>
    Promise.all(
      names.map((name) =>
        createDataRoomRepos(prisma).createItem(actor, {
          source: "drive",
          sha256: `${name}-${importId}`,
          name,
          mimeType: "text/plain",
          size: 1,
          importId,
        }),
      ),
    );
  const setStatus = (id: string, status: string) =>
    prisma.dataRoomItem.update({ where: { id }, data: { status } });
  const notifications = (actor: Actor) =>
    prisma.notification.findMany({ where: { spaceId: actor.spaceId, userId: actor.userId } });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const make = async (label: string): Promise<Actor> => {
      const userId = `dri-user-${label}-${run}`;
      const orgId = `dri-org-${label}-${run}`;
      const spaceId = `dri-space-${label}-${run}`;
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      await prisma.organization.create({
        data: { id: orgId, name: label, slug: orgId, createdAt: new Date() },
      });
      await prisma.space.create({
        data: {
          id: spaceId,
          organizationId: orgId,
          name: label,
          isDefault: true,
          createdByUserId: userId,
        },
      });
      spaceIds.push(spaceId);
      return { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    };
    a = await make("a");
    b = await make("b");
    const second = `dri-user-a2-${run}`;
    await prisma.user.create({
      data: { id: second, name: "a2", email: `${second}@rakazo.test`, emailVerified: false },
    });
    a2 = { ...a, userId: second, email: `${second}@rakazo.test` };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.organization.deleteMany({
      where: { id: { startsWith: "dri-org-" }, slug: { endsWith: run } },
    });
    await prisma.user.deleteMany({ where: { id: { endsWith: run, startsWith: "dri-user-" } } });
    await close();
  });

  it("counts files as they settle, finishes on the last one and notifies once", async () => {
    const row = await createDataRoomImport(prisma, a, { source: "drive", total: 3 });
    const items = await files(a, row.id, ["one.txt", "two.txt", "three.txt"]);
    const view = async () => (await listDataRoomImports(prisma, a)).find((i) => i.id === row.id);

    expect(await view()).toMatchObject({
      total: 3,
      done: 0,
      failed: 0,
      inProgress: 3,
      finished: false,
    });
    await setStatus(items[0]!.item.id, "ready");
    await settleDataRoomImport(prisma, row.id);
    await setStatus(items[1]!.item.id, "failed");
    await settleDataRoomImport(prisma, row.id);
    expect(await view()).toMatchObject({ done: 1, failed: 1, inProgress: 1, finished: false });
    expect(await notifications(a)).toHaveLength(0);

    await setStatus(items[2]!.item.id, "ready");
    await settleDataRoomImport(prisma, row.id);
    const finished = await view();
    expect(finished).toMatchObject({ done: 2, failed: 1, inProgress: 0, finished: true });
    expect(finished?.latest.map((f) => f.name).sort()).toEqual(["one.txt", "three.txt"]);
    expect(await notifications(a)).toMatchObject([
      {
        surface: "data-room",
        importance: "info",
        title: "Imported 2 files from Google Drive",
        body: "1 failed",
        dedupeKey: `data-room-import:${row.id}`,
      },
    ]);
    // Settling again changes nothing.
    await settleDataRoomImport(prisma, row.id);
    expect(await notifications(a)).toHaveLength(1);
  });

  it("counts a file in the last step (indexing) as done in the list", async () => {
    const row = await createDataRoomImport(prisma, a, { source: "drive", total: 2 });
    const items = await files(a, row.id, ["idx-one.txt", "idx-two.txt"]);
    await setStatus(items[0]!.item.id, "indexing");
    await setStatus(items[1]!.item.id, "classifying");
    const view = (await listDataRoomImports(prisma, a)).find((i) => i.id === row.id);
    expect(view).toMatchObject({ done: 1, inProgress: 1, finished: false });
  });

  it("finishes an import whose files were all skipped, failed, or never existed", async () => {
    const skipped = await createDataRoomImport(prisma, a, { source: "drive", total: 2 });
    await recordImportSkips(prisma, skipped.id, { rejected: 1 });
    expect(
      (await prisma.dataRoomImport.findUniqueOrThrow({ where: { id: skipped.id } })).finishedAt,
    ).toBeNull();
    await recordImportSkips(prisma, skipped.id, { rejected: 1 });
    expect(
      (await prisma.dataRoomImport.findUniqueOrThrow({ where: { id: skipped.id } })).finishedAt,
    ).not.toBeNull();

    const allFailed = await createDataRoomImport(prisma, a, { source: "gmail", total: 1 });
    const [only] = await files(a, allFailed.id, ["bad.pdf"]);
    await setStatus(only!.item.id, "failed");
    await settleDataRoomImport(prisma, allFailed.id);

    const empty = await createDataRoomImport(prisma, a, { source: "drive", total: 0 });
    expect(
      (await prisma.dataRoomImport.findUniqueOrThrow({ where: { id: empty.id } })).finishedAt,
    ).not.toBeNull();

    const titles = (await notifications(a)).map((n) => n.title);
    expect(titles).toContain("Google Drive import failed");
    expect(titles).toContain("Email import failed");
    // The empty import is finished and says nothing, in the list or in notifications.
    expect(titles).toHaveLength(3);
    expect((await listDataRoomImports(prisma, a)).some((i) => i.id === empty.id)).toBe(false);
  });

  it("counts files already in the Data room as done, and says nothing when nothing is new", async () => {
    const before = (await notifications(a)).length;
    const dup = await createDataRoomImport(prisma, a, { source: "drive", total: 2 });
    await recordImportSkips(prisma, dup.id, { duplicates: 2 });
    expect((await notifications(a)).length).toBe(before);
    expect((await listDataRoomImports(prisma, a)).some((i) => i.id === dup.id)).toBe(false);

    const mixed = await createDataRoomImport(prisma, a, { source: "drive", total: 2 });
    const [fresh] = await files(a, mixed.id, ["fresh.txt"]);
    await recordImportSkips(prisma, mixed.id, { duplicates: 1 });
    await setStatus(fresh!.item.id, "ready");
    await settleDataRoomImport(prisma, mixed.id);
    expect((await notifications(a)).at(-1)).toBeDefined();
    expect(
      (await notifications(a)).filter((n) => n.dedupeKey === `data-room-import:${mixed.id}`),
    ).toMatchObject([{ title: "Imported 1 file from Google Drive", body: null }]);
  });

  it("sends one notification when the last files settle at the same time", async () => {
    const row = await createDataRoomImport(prisma, a, { source: "drive", total: 6 });
    const items = await files(a, row.id, ["a", "b", "c", "d", "e", "f"]);
    await Promise.all(items.map((i) => setStatus(i.item.id, "ready")));
    await Promise.all(items.map(() => settleDataRoomImport(prisma, row.id)));
    expect(
      (await notifications(a)).filter((n) => n.dedupeKey === `data-room-import:${row.id}`),
    ).toHaveLength(1);
  });

  it("lists only the caller's imports, and drops finished ones after a few minutes", async () => {
    const mine = await createDataRoomImport(prisma, a, { source: "drive", total: 1 });
    const theirs = await createDataRoomImport(prisma, a2, { source: "drive", total: 1 });
    const other = await createDataRoomImport(prisma, b, { source: "drive", total: 1 });
    await files(a2, theirs.id, ["theirs.txt"]);
    await files(b, other.id, ["other.txt"]);
    const ids = async (actor: Actor, now?: Date) =>
      (await listDataRoomImports(prisma, actor, now)).map((i) => i.id);
    expect(await ids(a)).toContain(mine.id);
    expect(await ids(a)).not.toContain(theirs.id);
    expect(await ids(a)).not.toContain(other.id);
    expect(await ids(a2)).toEqual([theirs.id]);
    expect(await ids(b)).toEqual([other.id]);

    // An item of another user's import never shows in this user's names.
    const stolen = await createDataRoomImport(prisma, a, { source: "drive", total: 1 });
    await files(b, stolen.id, ["secret.txt"]);
    const view = (await listDataRoomImports(prisma, a)).find((i) => i.id === stolen.id);
    expect(view?.latest).toEqual([]);

    // A finished import stays for five minutes; one that never finished stays for a day.
    const finished = await createDataRoomImport(prisma, b, { source: "drive", total: 1 });
    const [done] = await files(b, finished.id, ["done.txt"]);
    await setStatus(done!.item.id, "ready");
    await settleDataRoomImport(prisma, finished.id);
    expect(await ids(b)).toContain(finished.id);
    expect(await ids(b, new Date(Date.now() + 6 * 60_000))).not.toContain(finished.id);
    expect(await ids(b, new Date(Date.now() + 25 * 3_600_000))).not.toContain(other.id);
  });
});
