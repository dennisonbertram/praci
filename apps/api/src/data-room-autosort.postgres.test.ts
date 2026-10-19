import { randomUUID } from "node:crypto";
import type { DataRoomAi } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDataRoomService } from "./data-room.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const fakeAi = (allowed: boolean): DataRoomAi => ({
  model: { provider: "openai-compatible", id: "chat-1" } as DataRoomAi["model"],
  embedder: null,
  embeddingModel: null,
  recipients: [],
  consentKey: "data-room:test",
  allowed,
});

describePostgres("Data room auto-sort service (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let a: Actor;
  let spaceId: string;
  let allowed = true;
  let answer: unknown = null;
  let asked: string[] = [];
  const service = () =>
    createDataRoomService({
      prisma,
      artifacts: {} as never,
      jobs: { enqueue: async () => {} },
      resolveAi: async () => fakeAi(allowed),
      proposeSort: async (_model, input) => {
        asked.push(JSON.stringify(input));
        if (answer instanceof Error) throw answer;
        return answer;
      },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const orgId = `asv-org-${run}`;
    spaceId = `asv-space-${run}`;
    const userId = `asv-user-${run}`;
    await prisma.user.create({
      data: { id: userId, name: "a", email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: orgId, name: "a", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: {
        id: spaceId,
        organizationId: orgId,
        name: "a",
        isDefault: true,
        createdByUserId: userId,
      },
    });
    a = { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await prisma.organization.deleteMany({ where: { id: `asv-org-${run}` } });
    await prisma.user.deleteMany({ where: { id: `asv-user-${run}` } });
    await close();
  });

  it("plans with the model only when consent is on, sends no document text, applies and undoes", async () => {
    const repo = createDataRoomRepos(prisma);
    await repo.createFolder(a, { name: "Benefits" });
    const ben2 = await repo.createFolder(a, { name: "Benefits (2)" });
    const { item } = await repo.createItem(a, {
      source: "upload",
      sha256: `asv-${run}`,
      name: "Screenshot 2026-10-18 at 9.10.50 AM.png",
      mimeType: "image/png",
      size: 1,
      folderId: ben2.id,
    });
    await prisma.dataRoomItem.update({
      where: { id: item.id },
      data: {
        classifiedAt: new Date(),
        status: "ready",
        docType: "statement",
        summary: "Dental plan costs.",
      },
    });
    await prisma.dataRoomItemText.create({
      data: { itemId: item.id, spaceId, userId: a.userId, text: "SECRET FULL TEXT" },
    });
    const svc = service();

    allowed = false;
    answer = { items: [{ id: item.id, folderPath: ["Elsewhere"] }] };
    const basic = await svc.autoSort.plan(a);
    expect(basic.mode).toBe("basic");
    expect(basic.reason).toBe("ai_unavailable");
    expect(basic.operations.map((o) => o.type)).toEqual(["merge_folder"]);
    expect(asked).toEqual([]);

    allowed = true;
    answer = new Error("model down");
    expect((await svc.autoSort.plan(a)).reason).toBe("ai_failed");

    answer = {
      items: [{ id: item.id, folderPath: ["Benefits", "Dental"], name: "Dental statement 2026" }],
    };
    asked = [];
    const plan = await svc.autoSort.plan(a);
    expect(plan.mode).toBe("ai");
    expect(plan.operations.map((o) => o.type)).toEqual([
      "merge_folder",
      "move_item",
      "rename_item",
    ]);
    expect(asked[0]).toContain("Dental plan costs.");
    expect(asked[0]).not.toContain("SECRET FULL TEXT");

    const before = await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: item.id } });
    const done = await svc.autoSort.apply(a, { operations: plan.operations });
    expect(done).toMatchObject({ items: 1, skipped: 0 });
    const after = await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.name).toBe("Dental statement 2026.png");
    expect(after.folderId).not.toBe(before.folderId);

    await svc.autoSort.undo(a, done.batchId);
    const restored = await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: item.id } });
    expect([restored.name, restored.folderId]).toEqual([before.name, before.folderId]);
  });
});
