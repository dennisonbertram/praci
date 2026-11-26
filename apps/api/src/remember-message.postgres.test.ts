import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { MarkdownMemoryStore } from "@rakazo/memory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("remember a message (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `rm-org-${suffix}`;
  const spaceId = `rm-space-${suffix}`;
  const alice: Actor = {
    spaceId,
    userId: `rm-alice-${suffix}`,
    email: "a@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: `rm-bob-${suffix}`, email: "b@example.test" };
  const botA = `rm-bot-a-${suffix}`;
  const botB = `rm-bot-b-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botMessage: string;
  let userMessage: string;
  let otherUsersMessage: string;
  const clientFor = (actor: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        memory: new MarkdownMemoryStore(prisma),
        env: { mailWritesDisabled: false },
      } as unknown as RouterDeps),
      { context: { actor } },
    );

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob].map((a) => ({
        id: a.userId,
        name: a.userId,
        email: `${a.userId}@x.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "RM Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
    for (const [id, a] of [
      [botA, alice],
      [botB, bob],
    ] as const) {
      await prisma.bot.create({
        data: {
          id,
          spaceId,
          userId: a.userId,
          name: id,
          color: "ink",
          thread: { create: { spaceId, userId: a.userId } },
        },
      });
    }
    const threadOf = async (botId: string) =>
      (await prisma.thread.findFirstOrThrow({ where: { botId } })).id;
    const create = async (botId: string, role: string, text: string, seq: number) =>
      (
        await prisma.message.create({
          data: {
            threadId: await threadOf(botId),
            seq,
            role,
            botId: role === "bot" ? botId : null,
            blocks: [{ kind: "text", text }],
          },
        })
      ).id;
    botMessage = await create(botA, "bot", "**Prefers** morning meetings", 1);
    userMessage = await create(botA, "user", "my own words", 2);
    otherUsersMessage = await create(botB, "bot", "bob private", 1);
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice.userId, bob.userId] } } });
    await close();
  });

  it("saves the message text to that bot's memory once and reports it as remembered", async () => {
    const client = clientFor(alice);
    expect(await client.threads.remember({ botId: botA, messageId: botMessage })).toEqual({
      ok: true,
    });
    await client.threads.remember({ botId: botA, messageId: botMessage });
    const docs = await prisma.memoryDocument.findMany({
      where: { spaceId, userId: alice.userId, scope: "bot", botId: botA },
      include: { revisions: true },
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      path: `remembered/${botMessage}.md`,
      content: "Prefers morning meetings",
      revision: 1,
      // Remember is the owner's own choice, so the memory never fades.
      pinned: true,
    });
    expect(docs[0]!.revisions[0]!.sourceThreadId).toBeTruthy();
    expect(await client.threads.remembered({ botId: botA })).toEqual({ messageIds: [botMessage] });
  });

  it("lists and exports memories newest first whatever order they were saved in", async () => {
    const client = clientFor(alice);
    const seededAt = Date.now();
    for (const [path, ageMs] of [
      ["a.md", 60_000],
      ["b.md", 30_000],
    ] as const) {
      await prisma.memoryDocument.create({
        data: {
          spaceId,
          userId: alice.userId,
          scope: "user",
          path,
          content: `content of ${path}`,
          createdAt: new Date(seededAt - ageMs),
          updatedAt: new Date(seededAt - ageMs),
        },
      });
    }
    const listedPaths = async () =>
      (await client.memory.list({ scope: "user" })).map((doc) => doc.path);
    expect(await listedPaths()).toEqual(["b.md", "a.md"]);
    const a = (await client.memory.list({ scope: "user" })).find((doc) => doc.path === "a.md")!;
    await client.memory.update({ documentId: a.id, content: "changed a" });
    expect(await listedPaths()).toEqual(["a.md", "b.md"]);
  });

  it("refuses user messages, another user's bot and another thread's message", async () => {
    await expect(
      clientFor(alice).threads.remember({ botId: botA, messageId: userMessage }),
    ).rejects.toBeDefined();
    await expect(
      clientFor(alice).threads.remember({ botId: botB, messageId: otherUsersMessage }),
    ).rejects.toBeDefined();
    await expect(
      clientFor(alice).threads.remember({ botId: botA, messageId: otherUsersMessage }),
    ).rejects.toBeDefined();
    expect(await prisma.memoryDocument.count({ where: { botId: botB } })).toBe(0);
  });

  it("deletes one memory with its revisions, only for its owner and only at the revision seen", async () => {
    const client = clientFor(alice);
    const doc = await prisma.memoryDocument.findFirstOrThrow({
      where: { spaceId, userId: alice.userId, botId: botA, path: `remembered/${botMessage}.md` },
    });
    await expect(
      clientFor(bob).memory.remove({ documentId: doc.id, revision: doc.revision }),
    ).rejects.toBeDefined();
    expect(await prisma.memoryDocument.count({ where: { id: doc.id } })).toBe(1);
    await expect(
      client.memory.remove({ documentId: doc.id, revision: doc.revision + 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.memoryDocument.count({ where: { id: doc.id } })).toBe(1);
    expect(await client.memory.remove({ documentId: doc.id, revision: doc.revision })).toEqual({
      ok: true,
    });
    expect(await prisma.memoryDocument.count({ where: { id: doc.id } })).toBe(0);
    expect(await prisma.memoryRevision.count({ where: { documentId: doc.id } })).toBe(0);
    expect(await client.threads.remembered({ botId: botA })).toEqual({ messageIds: [] });
    await expect(
      client.memory.remove({ documentId: doc.id, revision: doc.revision }),
    ).rejects.toBeDefined();
  });

  it("refuses an update made from a stale copy when the revision is sent", async () => {
    const client = clientFor(alice);
    await client.threads.remember({ botId: botA, messageId: botMessage });
    const doc = await prisma.memoryDocument.findFirstOrThrow({
      where: { spaceId, userId: alice.userId, botId: botA },
    });
    const first = await client.memory.update({
      documentId: doc.id,
      content: "fresh",
      expectedRevision: doc.revision,
    });
    await expect(
      client.memory.update({
        documentId: doc.id,
        content: "stale",
        expectedRevision: doc.revision,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await prisma.memoryDocument.findUniqueOrThrow({ where: { id: doc.id } })).content).toBe(
      "fresh",
    );
    // Without a revision the update still goes through.
    expect((await client.memory.update({ documentId: doc.id, content: "plain" })).revision).toBe(
      first.revision + 1,
    );
  });
});
