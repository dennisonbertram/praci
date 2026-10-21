import { createRouterClient } from "@orpc/server";
import { runDevinRefreshJob } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { devinSessionUrl } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

// Invented sessions in the documented line format; no real Devin account is involved.
const search = (updatedAt: number) =>
  `- id=devin-w1 title="Fix the login loop" status=blocked status_detail=waiting_for_user updated_at=${updatedAt} origin=webapp`;
const message = (eventId: string, body: string) =>
  `- event_id=${eventId} source=devin created_at=1760003600 body="${body}"`;

describePostgres("Devin journey (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `dvj-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const actor = (name: string): Actor => ({
    userId: id(name),
    spaceId,
    email: `${id(name)}@example.test`,
    isDeploymentOwner: false,
  });
  const owner1 = actor("owner1");
  const owner2 = actor("owner2");
  const member = actor("member");
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;

  // The fake Devin: what the sessions say, and which key it refuses.
  let updatedAt = 1760003000;
  let question = message("ev-1", "Which environment should I test against?");
  let refusedKey = "";
  const callTool = vi.fn(async (serverId: string, name: string) => {
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    const secret = row.secretId
      ? await prisma.secret.findUniqueOrThrow({ where: { id: row.secretId } })
      : null;
    if (refusedKey && secret?.ciphertext.includes(refusedKey))
      throw new Error("Unauthorized (HTTP 401)");
    return name === "devin_session_search" ? search(updatedAt) : question;
  });
  const signals = vi.fn(async () => {});
  const jobs = { enqueue: vi.fn(async () => undefined), cancel: async () => undefined };
  const client = (who: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        env: {},
        secrets: {
          put: async (plaintext: string) => ({ id: id(`secret-${n++}`), ciphertext: plaintext }),
        },
        mcp: { listServerTools: async () => [], callServerTool: async () => ({}) },
        devinCallTool: callTool,
        notificationEvents: { notify: signals },
        sandbox: {},
        home: {},
        jobs,
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
  /** The `devin.refresh` job the API queued, run by hand the way the worker would. */
  const runQueuedRefresh = async () => {
    const job = jobs.enqueue.mock.calls.at(-1) as unknown as [{ payload: { serverId: string } }];
    await runDevinRefreshJob(
      { prisma, callTool, notificationEvents: { notify: signals } as never },
      job[0].payload,
    );
  };
  const alerts = (userId: string) =>
    prisma.notification.findMany({ where: { spaceId, userId, surface: "devin" } });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const who of [owner1, owner2, member]) {
      await prisma.user.create({
        data: { id: who.userId, name: who.userId, email: who.email, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "General" } });
    for (const who of [owner1, owner2, member]) {
      await prisma.member.create({
        data: {
          id: id(`m-${who.userId}`),
          organizationId: orgId,
          userId: who.userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    await prisma.spaceMember.deleteMany({ where: { spaceId } });
    for (const [who, role] of [
      [owner1, "owner"],
      [owner2, "owner"],
      [member, "member"],
    ] as const) {
      await prisma.spaceMember.create({
        data: {
          id: id(`sm-${who.userId}`),
          spaceId,
          organizationId: orgId,
          userId: who.userId,
          role,
          createdAt: new Date(),
        },
      });
    }
    // Both owners can be reached by phone push, so an alert queues a delivery.
    for (const who of [owner1, owner2]) {
      await prisma.notificationEndpoint.create({
        data: {
          userId: who.userId,
          channel: "push",
          address: `token-${who.userId}`,
          deviceId: `device-${who.userId}`,
        },
      });
    }
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.mcpServer.deleteMany({ where: { spaceId } });
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({
      where: { id: { in: [owner1, owner2, member].map((who) => who.userId) } },
    });
    await close();
  });

  it("alerts the connector once with a link to the session, shows it under Needs you, and after a rejected key and a replacement alerts the new owner", async () => {
    // Connect, and the first refresh only records what is already waiting.
    await client(owner1).devin.connect({ secret: "key-one" });
    await runQueuedRefresh();
    expect(await alerts(owner1.userId)).toHaveLength(0);

    // Devin asks something new: the connector gets one alert, and a delivery is queued for the push.
    updatedAt += 600;
    question = message("ev-2", "Staging or production?");
    await runQueuedRefresh();
    await runQueuedRefresh();
    const [alert] = await alerts(owner1.userId);
    expect(await alerts(owner1.userId)).toHaveLength(1);
    expect(alert).toMatchObject({
      title: "Devin needs input",
      body: "Fix the login loop: Staging or production?",
      link: devinSessionUrl("devin-w1"),
      kind: "needs_input",
    });
    expect(signals).toHaveBeenCalledTimes(1);
    expect(
      await prisma.notificationDelivery.findMany({ where: { notificationId: alert?.id } }),
    ).toMatchObject([{ channel: "push" }]);

    // Every member sees the session under Needs you.
    const page = await client(member).devin.sessions();
    expect(page.sessions).toMatchObject([{ id: "devin-w1", kind: "needs_you" }]);

    // A refresh started by a page read alerts too.
    updatedAt += 600;
    question = message("ev-2b", "Should I also bump the SDK?");
    await prisma.devinConnectionState.update({
      where: { spaceId },
      data: { lastSucceededAt: new Date(Date.now() - 5 * 60_000) },
    });
    await client(member).devin.sessions();
    expect(await alerts(owner1.userId)).toHaveLength(2);
    expect(signals).toHaveBeenCalledTimes(2);

    // Devin refuses the key: the connection stops and nobody is alerted.
    refusedKey = "key-one";
    await prisma.devinConnectionState.update({
      where: { spaceId },
      data: { lastSucceededAt: new Date(Date.now() - 5 * 60_000) },
    });
    expect((await client(member).devin.sessions()).connection.status).toBe("rejected");

    // A second owner replaces the key; the first refresh is silent, the next question alerts them.
    refusedKey = "";
    await client(owner2).devin.replaceKey({ secret: "key-two" });
    await runQueuedRefresh();
    expect(await alerts(owner2.userId)).toHaveLength(0);
    updatedAt += 600;
    question = message("ev-3", "Is the staging database safe to reset?");
    await runQueuedRefresh();
    expect(await alerts(owner2.userId)).toMatchObject([
      { body: "Fix the login loop: Is the staging database safe to reset?" },
    ]);
    expect(await alerts(owner1.userId)).toHaveLength(2);
  });
});
