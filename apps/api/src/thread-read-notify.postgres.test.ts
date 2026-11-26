import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { NOTIFICATION_CATCH_UP_ID } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createThreadMessage } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("thread read changes signal the owner's other tabs (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `trn-org-${suffix}`;
  const spaceId = `trn-space-${suffix}`;
  const alice: Actor = {
    spaceId,
    userId: `trn-alice-${suffix}`,
    email: "a@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: `trn-bob-${suffix}`, email: "b@example.test" };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const notify = vi.fn(async () => {});
  const clientFor = (actor: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        notificationEvents: { notify, follow: async function* () {} },
        env: {},
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
      data: { id: organizationId, name: "Notify Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice.userId, bob.userId] } } });
    await close();
  });

  it("notifies only the actor, only when the flag changed", async () => {
    const bot = await prisma.bot.create({
      data: {
        spaceId,
        userId: alice.userId,
        name: "Notify",
        color: "#000000",
        thread: { create: { spaceId, userId: alice.userId } },
      },
      include: { thread: true },
    });
    const thread = bot.thread!;
    await createThreadMessage(prisma, {
      threadId: thread.id,
      role: "bot",
      blocks: [{ kind: "text", text: "hi" }],
    });
    const client = clientFor(alice);
    const input = { botId: bot.id };

    await client.threads.markRead({ ...input, toEnd: true });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      { spaceId, userId: alice.userId },
      { id: NOTIFICATION_CATCH_UP_ID, surface: "threads", importance: "info" },
    );
    await client.threads.markRead({ ...input, toEnd: true });
    expect(notify).toHaveBeenCalledTimes(1);
    await client.threads.markUnread(input);
    expect(notify).toHaveBeenCalledTimes(2);
    await client.threads.markUnread(input);
    expect(notify).toHaveBeenCalledTimes(2);
    // Another user cannot reach the thread, so nothing is signalled for them.
    await expect(clientFor(bob).threads.markRead({ ...input, toEnd: true })).rejects.toThrow();
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
