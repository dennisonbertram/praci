import { randomUUID } from "node:crypto";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { dataRoomToolFromTool } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb, IsolationError } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dataRoomReferenceLines, type ThreadTarget } from "./thread-target.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("Send to agent: Data room references (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const makeActor = (name: string): Actor => ({
    userId: `send-${name}-user-${suffix}`,
    spaceId: `send-${name}-space-${suffix}`,
    email: `${name}-${suffix}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const owner = makeActor("owner");
  const other = makeActor("other");
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let itemId: string;
  let otherItemId: string;
  let plainBot: ThreadTarget;
  let integrationBot: ThreadTarget;

  const target = (botId: string) => ({ kind: "bot", botId, threadId: "unused" }) as ThreadTarget;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const who of [owner, other]) {
      await prisma.user.create({
        data: { id: who.userId, name: who.userId, email: who.email, emailVerified: false },
      });
      await prisma.organization.create({
        data: {
          id: `org-${who.spaceId}`,
          name: "Org",
          slug: `org-${who.spaceId}`,
          createdAt: new Date(),
        },
      });
      await prisma.space.create({
        data: {
          id: who.spaceId,
          organizationId: `org-${who.spaceId}`,
          name: "General",
          isDefault: true,
        },
      });
    }
    const repo = createDataRoomRepos(prisma);
    const make = async (who: Actor, name: string) => {
      const { item } = await repo.createItem(who, {
        source: "upload",
        sha256: randomUUID(),
        name,
        mimeType: "text/plain",
        size: 12,
      });
      await repo.finishExtraction(who, item.id, 0, "Sample ledger text");
      return item.id;
    };
    itemId = await make(owner, "Sample agreement.txt");
    otherItemId = await make(other, "Private notes.txt");
    const bot = (name: string, spawnKey?: string) =>
      prisma.bot.create({
        data: { spaceId: owner.spaceId, userId: owner.userId, name, color: "blue", spawnKey },
      });
    plainBot = target((await bot("Chief")).id);
    integrationBot = target((await bot("Carta", `integration-agent:${randomUUID()}`)).id);
  });

  afterAll(async () => {
    if (!prisma) return;
    for (const who of [owner, other]) {
      await prisma.organization.deleteMany({ where: { id: `org-${who.spaceId}` } });
      await prisma.user.deleteMany({ where: { id: who.userId } });
    }
    await close();
  });

  it("names the file by id, and the agent can open that id with read_data_room_item", async () => {
    const lines = await dataRoomReferenceLines(prisma, owner, plainBot, [itemId, itemId]);
    expect(lines).toEqual([`Data room item ${itemId}: Sample agreement.txt`]);

    const id = /^Data room item (\S+):/.exec(lines[0]!)?.[1];
    const read = await dataRoomToolFromTool(
      "read_data_room_item",
      {
        prisma,
        artifacts: {} as ArtifactStore,
        jobs: {} as JobPublisher,
        resolveAi: async () => ({ allowed: true }) as never,
        scope: { spaceId: owner.spaceId, userId: owner.userId },
        mailAccounts: async () => [],
        driveAccounts: async () => [],
      },
      {} as never,
      { item_id: id },
    );
    expect(read).toMatchObject({ name: "Sample agreement.txt", text: "Sample ledger text" });
  });

  it("refuses another user's item", async () => {
    await expect(
      dataRoomReferenceLines(prisma, owner, plainBot, [otherItemId]),
    ).rejects.toBeInstanceOf(IsolationError);
  });

  it("refuses an agent without Data room tools, so the client attaches a copy instead", async () => {
    await expect(dataRoomReferenceLines(prisma, owner, integrationBot, [itemId])).rejects.toThrow(
      "cannot open the Data room",
    );
  });

  it("refuses a bot that is not the sender's", async () => {
    await expect(
      dataRoomReferenceLines(prisma, other, plainBot, [otherItemId]),
    ).rejects.toBeInstanceOf(IsolationError);
  });

  it("sends nothing when no files are named", async () => {
    expect(await dataRoomReferenceLines(prisma, owner, plainBot, undefined)).toEqual([]);
  });
});
