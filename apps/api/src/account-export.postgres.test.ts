import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createArtifactStore } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mountAccountExportDownload } from "./account-export.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("account export download (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const space = `dl-space-${run}`;
  const owner = `dl-a-${run}`;
  const other = `dl-b-${run}`;
  const bytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let app: Hono;
  let ready: string;
  let expired: string;
  let running: string;

  const get = (id: string, user?: string) =>
    app.request(
      `/api/account/exports/${id}/download`,
      user ? { headers: { "x-test-user": user } } : {},
    );

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const artifacts = createArtifactStore(process.env, await mkdtemp(path.join(tmpdir(), "dl-")));
    await prisma.user.createMany({
      data: [owner, other].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    const stored = await artifacts.put(
      { name: "e.zip", mimeType: "application/zip", bytes },
      {
        operationId: "t",
        traceId: "t",
        spaceId: space,
        userId: owner,
        signal: new AbortController().signal,
      },
    );
    const row = (status: string, expiresAt: Date, storageKey: string | null) =>
      prisma.accountExport
        .create({
          data: { userId: owner, spaceId: space, status, storageKey, size: 7n, expiresAt },
        })
        .then((r) => r.id);
    const later = new Date(Date.now() + 86_400_000);
    ready = await row("ready", later, stored.id);
    expired = await row("ready", new Date(Date.now() - 1000), stored.id);
    running = await row("failed", later, null);
    app = new Hono();
    mountAccountExportDownload(app, { prisma, artifacts }, async (request) => {
      const userId = request.headers.get("x-test-user");
      return userId
        ? ({ userId, spaceId: space, email: "", isDeploymentOwner: false } as Actor)
        : null;
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
    await close();
  });

  it("streams the owner's finished export as a zip download", async () => {
    const response = await get(ready, owner);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("refuses other users and signed-out requests", async () => {
    expect((await get(ready, other)).status).toBe(404);
    expect((await get(ready)).status).toBe(401);
  });

  it("does not serve an expired, unfinished or unknown export", async () => {
    expect((await get(expired, owner)).status).toBe(404);
    expect((await get(running, owner)).status).toBe(404);
    expect((await get("nope", owner)).status).toBe(404);
  });
});
