import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createDataRoomRepos } from "./data-room.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("Data room stats (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let a: Actor;
  let b: Actor;
  let folderId: string;
  const spaceIds: string[] = [];

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const make = async (label: string): Promise<Actor> => {
      const userId = `drs-user-${label}-${run}`;
      const orgId = `drs-org-${label}-${run}`;
      const spaceId = `drs-space-${label}-${run}`;
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
    folderId = (await createDataRoomRepos(prisma).createFolder(a, { name: "Deals" })).id;
    const item = (who: Actor, name: string, data: Record<string, unknown>) =>
      prisma.dataRoomItem.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          source: "upload",
          sha256: name,
          name,
          mimeType: "application/pdf",
          size: 100,
          status: "ready",
          ...data,
        },
      });
    await item(a, "nda.pdf", {
      folderId,
      docType: "legal",
      docDate: new Date("2026-01-15"),
      parties: ["Acme (Mock)", "Beta (Mock)"],
      size: 5_000,
      amountCents: 250_000,
      currency: "USD",
    });
    await item(a, "nda-copy.pdf", {
      folderId,
      sha256: "nda.pdf",
      source: "drive",
      docType: "legal",
      docDate: new Date("2026-03-02"),
      parties: ["Acme (Mock)"],
    });
    await item(a, "deck.pdf", { source: "drive", docType: "investor", status: "failed" });
    await item(a, "big.mov", { source: "box", notIndexed: true, size: 9_000_000 });
    await item(a, "wip.pdf", { status: "extracting" });
    await item(b, "other.pdf", { docType: "legal", parties: ["Acme (Mock)"] });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.organization.deleteMany({ where: { id: { startsWith: "drs-org-" } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: "drs-user-" } } });
    await close();
  });

  it("counts each group for the caller only", async () => {
    const stats = await createDataRoomRepos(prisma).stats(a);
    expect(stats.documents).toBe(5);
    expect(stats.bytes).toBe(5_000 + 100 * 3 + 9_000_000);
    expect(stats.duplicates).toBe(1);
    expect(stats.status).toEqual({ ready: 2, processing: 1, failed: 1, notSearchable: 1 });
    expect(stats.types).toEqual([
      { value: "legal", count: 2 },
      { value: "investor", count: 1 },
    ]);
    expect(stats.sources).toEqual([
      { value: "drive", count: 2 },
      { value: "upload", count: 2 },
      { value: "box", count: 1 },
    ]);
    expect(stats.parties).toEqual([
      { value: "Acme (Mock)", count: 2 },
      { value: "Beta (Mock)", count: 1 },
    ]);
    expect(stats.largest.map((f) => f.name).slice(0, 2)).toEqual(["big.mov", "nda.pdf"]);
    expect(stats.largest[0]?.size).toBe(9_000_000);
    expect(stats.dates).toEqual({
      unit: "month",
      buckets: [
        { key: "2026-01", count: 1 },
        { key: "2026-02", count: 0 },
        { key: "2026-03", count: 1 },
      ],
    });
    expect(stats.amounts).toEqual([
      { docType: "legal", currency: "USD", cents: 250_000, count: 1 },
    ]);
    expect((await createDataRoomRepos(prisma).stats(b)).documents).toBe(1);
  });

  it("scopes to a folder and to filters", async () => {
    const repo = createDataRoomRepos(prisma);
    const inFolder = await repo.stats(a, { folderId });
    expect(inFolder.documents).toBe(2);
    expect(inFolder.sources).toEqual([
      { value: "drive", count: 1 },
      { value: "upload", count: 1 },
    ]);
    const acme = await repo.stats(a, { party: "Beta (Mock)" });
    expect(acme.documents).toBe(1);
    expect((await repo.stats(a, { folderId: randomUUID() })).documents).toBe(0);
  });

  it("groups by year when the dates span over three years", async () => {
    const make = (name: string, docDate: string) =>
      prisma.dataRoomItem.create({
        data: {
          spaceId: b.spaceId,
          userId: b.userId,
          source: "upload",
          sha256: name,
          name,
          mimeType: "application/pdf",
          size: 1,
          docDate: new Date(docDate),
        },
      });
    const old = await make("old.pdf", "2021-06-01");
    const recent = await make("recent.pdf", "2026-01-01");
    const { dates } = await createDataRoomRepos(prisma).stats(b);
    expect(dates.unit).toBe("year");
    expect(dates.buckets.map((x) => x.key)).toEqual([
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
      "2026",
    ]);
    await prisma.dataRoomItem.deleteMany({ where: { id: { in: [old.id, recent.id] } } });
  });
});
