import type { ArtifactStore } from "@rakazo/adapter-kit";
import { buildXlsx } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb, IsolationError } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spreadsheetPreview } from "./spreadsheet-preview.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describePostgres("spreadsheetPreview (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `sheet-user-${suffix}`;
  const organizationId = `sheet-org-${suffix}`;
  const spaceId = `sheet-space-${suffix}`;
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  };
  const otherUser: Actor = { ...actor, userId: `${userId}-other` };
  const otherSpace: Actor = { ...actor, spaceId: `${spaceId}-other` };
  const blobs = new Map<string, Uint8Array>();
  const artifacts = { get: async (key: string) => blobs.get(key) } as unknown as ArtifactStore;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const revenue = [
    ["Region", "Amount"],
    ...Array.from({ length: 5 }, (_, i) => [`R${i + 1}`, (i + 1) * 100]),
  ];
  const artifact = async (name: string, mimeType: string, bytes: Uint8Array) => {
    const storageKey = `blob-${blobs.size}`;
    blobs.set(storageKey, bytes);
    return prisma.artifact.create({
      data: { spaceId, userId, name, mimeType, size: bytes.length, hash: storageKey, storageKey },
    });
  };
  const workbook = buildXlsx([
    { name: "Revenue", rows: revenue },
    {
      name: "Headcount",
      rows: [
        ["Team", "People"],
        ["Design", 6],
      ],
    },
  ]);

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Sheet Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  const preview = (source: Record<string, string>, extra: Record<string, unknown> = {}) =>
    spreadsheetPreview({ prisma, artifacts }, actor, {
      source,
      offset: 0,
      limit: 200,
      ...extra,
    } as never);

  it("returns sheet names, the header and rows with sheet row numbers", async () => {
    const row = await artifact("revenue.xlsx", XLSX, workbook);
    const result = await preview({ artifactId: row.id });
    expect(result).toMatchObject({
      status: "ready",
      sheet: "Revenue",
      columns: ["A", "B"],
      headerRow: 1,
      header: ["Region", "Amount"],
      truncated: false,
    });
    if (result.status !== "ready") throw new Error("not ready");
    expect(result.sheets.map((s) => s.name)).toEqual(["Revenue", "Headcount"]);
    expect(result.rows[0]).toEqual({ row: 2, cells: ["R1", 100] });
    expect(result.rows).toHaveLength(5);
  });

  it("selects a sheet and pages with offset and limit", async () => {
    const row = await artifact("paged.xlsx", XLSX, workbook);
    const second = await preview({ artifactId: row.id }, { sheet: "Headcount" });
    expect(second).toMatchObject({ sheet: "Headcount", header: ["Team", "People"] });
    const first = await preview({ artifactId: row.id }, { limit: 2 });
    if (first.status !== "ready") throw new Error("not ready");
    expect(first.rows.map((r) => r.row)).toEqual([2, 3]);
    expect(first.truncated).toBe(true);
    const next = await preview({ artifactId: row.id }, { limit: 2, offset: 2 });
    if (next.status !== "ready") throw new Error("not ready");
    expect(next.header).toEqual(["Region", "Amount"]);
    expect(next.rows.map((r) => r.row)).toEqual([4, 5]);
    expect(next.truncated).toBe(true);
    const last = await preview({ artifactId: row.id }, { limit: 2, offset: 4 });
    if (last.status !== "ready") throw new Error("not ready");
    expect(last.rows.map((r) => r.row)).toEqual([6]);
    expect(last.truncated).toBe(false);
  });

  it("reads csv", async () => {
    const row = await artifact("m.csv", "text/csv", new TextEncoder().encode("a,b\n1,2\n"));
    expect(await preview({ artifactId: row.id })).toMatchObject({
      status: "ready",
      header: ["a", "b"],
      rows: [{ row: 2, cells: ["1", "2"] }],
    });
  });

  it("returns unsupported for legacy .xls", async () => {
    const row = await artifact("old.xls", "application/vnd.ms-excel", Uint8Array.of(0xd0, 0xcf));
    expect(await preview({ artifactId: row.id })).toMatchObject({ status: "unsupported" });
  });

  it("does not show another user's or space's artifact", async () => {
    const row = await artifact("secret.xlsx", XLSX, workbook);
    for (const who of [otherUser, otherSpace]) {
      await expect(
        spreadsheetPreview({ prisma, artifacts }, who, {
          source: { artifactId: row.id },
          offset: 0,
          limit: 200,
        }),
      ).rejects.toBeInstanceOf(IsolationError);
    }
  });

  it("reads a Data room item and hides it from others", async () => {
    blobs.set("dr-1", workbook);
    const { item } = await createDataRoomRepos(prisma).createItem(actor, {
      source: "upload",
      sha256: `sha-${suffix}`,
      name: "books.xlsx",
      mimeType: XLSX,
      size: workbook.length,
      storageKey: "dr-1",
    });
    expect(await preview({ dataRoomItemId: item.id })).toMatchObject({
      status: "ready",
      sheet: "Revenue",
    });
    for (const who of [otherUser, otherSpace]) {
      await expect(
        spreadsheetPreview({ prisma, artifacts }, who, {
          source: { dataRoomItemId: item.id },
          offset: 0,
          limit: 200,
        }),
      ).rejects.toBeInstanceOf(IsolationError);
    }
  });
});
