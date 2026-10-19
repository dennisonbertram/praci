import type {
  NotificationChannel,
  NotificationEndpointRef,
  NotificationEnvelope,
} from "@rakazo/adapter-kit";
import { createDb, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deliverDueNotifications } from "./notification-outbox.js";
import { notifyThreadEvent } from "./run-notification.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("finish, help and takeover notifications (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `rn-org-${suffix}`;
  const spaceId = `rn-space-${suffix}`;
  const userId = `rn-user-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const run = { spaceId, userId, botId: "bot-1", threadId: "thread-1", id: "run-1" };
  const message = (kind: "completion" | "failure" | "help" | "takeover", groupId?: string) => ({
    kind,
    title: `Ada ${kind}`,
    body: "Details",
    botId: "bot-1",
    threadId: "thread-1",
    ...(groupId ? { groupId } : {}),
  });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "RN Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
    await prisma.notificationEndpoint.create({
      data: { userId, channel: "push", address: "ExponentPushToken[a]", deviceId: "a" },
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("creates an attention notification on the thread, signals it, and the outbox pushes it", async () => {
    const notify = vi.fn(async () => {});
    expect(
      await notifyThreadEvent(
        prisma,
        { notify, follow: vi.fn() },
        run,
        message("completion"),
        "k1",
      ),
    ).toBe("created");
    const row = await prisma.notification.findFirstOrThrow({ where: { spaceId, userId } });
    expect(row).toMatchObject({
      surface: "thread",
      threadId: "thread-1",
      importance: "attention",
      link: "/app/bot-1",
      title: "Ada completion",
    });
    expect(notify).toHaveBeenCalledWith(
      { spaceId, userId },
      { id: row.id, surface: "thread", importance: "attention" },
    );
    const sent: NotificationEnvelope[] = [];
    const channel: NotificationChannel = {
      channel: "push",
      describe: () => ({
        id: "fake",
        contractVersion: "1",
        adapterVersion: "0",
        capabilities: { push: true, email: false },
      }),
      send: async (envelope: NotificationEnvelope, _e: NotificationEndpointRef) => {
        sent.push(envelope);
        return "sent";
      },
    };
    await deliverDueNotifications({
      prisma,
      channels: [channel],
      now: new Date(Date.now() + 60_000),
    });
    expect(sent.map((e) => e.id)).toEqual([row.id]);
  });

  it("links a group thread to the group and does not repeat the same event", async () => {
    expect(await notifyThreadEvent(prisma, undefined, run, message("help", "g1"), "k2")).toBe(
      "created",
    );
    expect(await notifyThreadEvent(prisma, undefined, run, message("help", "g1"), "k2")).toBe(
      "duplicate",
    );
    const row = await prisma.notification.findFirstOrThrow({ where: { title: "Ada help" } });
    expect(row.link).toBe("/app/g/g1");
  });

  it("is not rate limited like agent chatter", async () => {
    for (let i = 0; i < 8; i++) {
      expect(
        await notifyThreadEvent(prisma, undefined, run, message("takeover"), `burst-${i}`),
      ).toBe("created");
    }
  });

  it("creates nothing for a category the user switched off", async () => {
    await prisma.notificationPreference.create({
      data: { spaceId, userId, finish: false, help: true, takeover: false },
    });
    const before = await prisma.notification.count({ where: { spaceId, userId } });
    expect(await notifyThreadEvent(prisma, undefined, run, message("completion"), "k3")).toBe(
      "off",
    );
    expect(await notifyThreadEvent(prisma, undefined, run, message("failure"), "k4")).toBe("off");
    expect(await notifyThreadEvent(prisma, undefined, run, message("takeover"), "k5")).toBe("off");
    expect(await prisma.notification.count({ where: { spaceId, userId } })).toBe(before);
    expect(await notifyThreadEvent(prisma, undefined, run, message("help"), "k6")).toBe("created");
  });
});
