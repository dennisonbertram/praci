import type { MessagingSurface } from "@rakazo/adapter-kit";
import {
  createDb,
  createNotification,
  deleteExpiredMessagingTransport,
  type PrismaClient,
  updateNotificationPreferences,
} from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ImessageNotificationChannel, imessageNotificationText } from "./imessage-notification.js";
import {
  deliverMessagingOutbound,
  MESSAGING_AI_DISCLOSURE,
  MESSAGING_DM_OUTBOUND_CAP,
} from "./messaging-delivery.js";
import { deliverDueNotifications } from "./notification-outbox.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const sendToThread = vi.fn(async (_input: { threadId: string; body: string }) => ({
  handle: "h-1",
}));
const surface = {
  sendToThread,
  openDirectThread: vi.fn(async () => "thread-opened"),
} as unknown as MessagingSurface;
const context = {
  operationId: "t",
  traceId: "t",
  spaceId: "",
  userId: "",
  signal: new AbortController().signal,
};

describePostgres("iMessage notification channel and messaging retention (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `im-org-${suffix}`;
  const spaceId = `im-space-${suffix}`;
  const T0 = new Date("2030-01-01T00:00:00Z");
  const due = new Date(T0.getTime() + 31_000);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;
  const enqueue = vi.fn(async () => undefined);
  const channel = () =>
    new ImessageNotificationChannel({
      prisma,
      jobs: { enqueue } as never,
      appUrl: "https://app.example.test",
    });
  const drain = () =>
    deliverMessagingOutbound(
      { prisma, messaging: surface, events: {} as never, jobs: { enqueue } as never },
      {},
      context,
    );

  /** A user with a linked iMessage identity (or none) and one attention notification. */
  const setup = async (
    identity: Partial<{
      provider: string;
      lastInboundAt: Date | null;
      outboundSinceInbound: number;
    }> | null = {},
    prefs?: { imessage: boolean },
  ) => {
    const id = `${suffix}-${++n}`;
    await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
    if (identity) {
      await prisma.messagingIdentity.create({
        data: {
          provider: "bluebubbles",
          address: `+1555${String(n).padStart(7, "0")}`,
          dmThreadId: `dm-${id}`,
          userId: id,
          spaceId,
          botId: `bot-${id}`,
          verifiedAt: new Date(),
          lastInboundAt: new Date(),
          ...identity,
        },
      });
    }
    if (prefs)
      await updateNotificationPreferences(prisma, { spaceId, userId: id }, { channels: prefs });
    const created = await createNotification(prisma, {
      spaceId,
      userId: id,
      surface: "finance",
      title: "Runway dropped",
      body: "Below 12 months",
      link: "/app/finance",
      importance: "attention",
      now: T0,
    });
    if (created.status !== "created") throw new Error("expected created");
    return { userId: id, notification: created.notification };
  };
  const deliveries = (notificationId: string) =>
    prisma.notificationDelivery.findMany({ where: { notificationId } });
  const outboundFor = (notificationId: string) =>
    prisma.messagingOutbound.findMany({
      where: { idempotencyKey: `notification:${notificationId}` },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.organization.create({
      data: { id: organizationId, name: "IM Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
  });
  beforeEach(async () => {
    // A drain sends every pending row, so each test starts with none left by another.
    await prisma.messagingOutbound.deleteMany({ where: { status: "pending" } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.messagingOutbound.deleteMany({
      where: { idempotencyKey: { startsWith: "ret-" } },
    });
    await prisma.messagingInboundClaim.deleteMany({ where: { key: { startsWith: "ret-" } } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { startsWith: `${suffix}` } } });
    await close();
  });

  it("builds the text from title, body and an absolute link", () => {
    expect(
      imessageNotificationText(
        { title: "T", body: "B", link: "/app/x?y=1" } as never,
        "https://app.example.test",
      ),
    ).toBe("T\nB\nhttps://app.example.test/app/x?y=1");
    expect(
      imessageNotificationText({ title: "T", body: null, link: null } as never, "https://a.test"),
    ).toBe("T");
  });

  it("sends to the linked identity, then blanks the body once sent", async () => {
    const { notification } = await setup();
    expect((await deliveries(notification.id)).map((d) => d.channel)).toEqual(["imessage"]);
    await deliverDueNotifications({ prisma, channels: [channel()], now: due });
    expect((await deliveries(notification.id))[0]?.status).toBe("sent");
    const [row] = await outboundFor(notification.id);
    expect(row?.body).toBe("Runway dropped\nBelow 12 months\nhttps://app.example.test/app/finance");
    expect(enqueue).toHaveBeenCalled();

    sendToThread.mockClear();
    await drain();
    expect(sendToThread).toHaveBeenCalledOnce();
    expect(sendToThread.mock.calls[0]?.[0]).toMatchObject({ body: row?.body });
    expect(await outboundFor(notification.id)).toMatchObject([{ status: "sent", body: "" }]);
  });

  it("queues no delivery without a linked identity, and skips when the conversation is closed", async () => {
    const none = await setup(null);
    expect(await deliveries(none.notification.id)).toEqual([]);

    const stale = await setup({ lastInboundAt: new Date(Date.now() - 25 * 60 * 60_000) });
    await deliverDueNotifications({ prisma, channels: [channel()], now: due });
    expect((await deliveries(stale.notification.id))[0]?.status).toBe("skipped");
    expect(await outboundFor(stale.notification.id)).toEqual([]);
  });

  it("queues no delivery when the user switched iMessage off", async () => {
    const { notification } = await setup({}, { imessage: false });
    expect(await deliveries(notification.id)).toEqual([]);
  });

  it("writes one outbox row however often the notification is sent", async () => {
    const { userId, notification } = await setup();
    const endpoints = await channel().endpoints({ userId, spaceId });
    const envelope = { ...notification, groupId: null };
    await channel().send(envelope, endpoints[0]!, context);
    await channel().send(envelope, endpoints[0]!, context);
    expect(await outboundFor(notification.id)).toHaveLength(1);
  });

  it("does not send past the 140-message cap", async () => {
    const { notification } = await setup({ outboundSinceInbound: MESSAGING_DM_OUTBOUND_CAP });
    await deliverDueNotifications({ prisma, channels: [channel()], now: due });
    expect((await deliveries(notification.id))[0]?.status).toBe("skipped");
    expect(await outboundFor(notification.id)).toEqual([]);
  });

  it("sends Photon's AI disclosure before the first notification", async () => {
    const { notification } = await setup({ provider: "photon" });
    await deliverDueNotifications({ prisma, channels: [channel()], now: due });
    sendToThread.mockClear();
    await drain();
    expect(sendToThread.mock.calls.map((c) => c[0].body)).toEqual([
      MESSAGING_AI_DISCLOSURE,
      expect.stringContaining("Runway dropped"),
    ]);
    expect(await outboundFor(notification.id)).toMatchObject([{ body: "" }]);
  });

  it("keeps the body of a row that failed to send until retention", async () => {
    const { notification } = await setup();
    await deliverDueNotifications({ prisma, channels: [channel()], now: due });
    sendToThread.mockRejectedValueOnce(new Error("down"));
    await drain();
    const [row] = await outboundFor(notification.id);
    expect(row?.body).toContain("Runway dropped");
    expect(row?.status).toBe("pending");
  });

  it("deletes outbox rows and claims older than 7 days in batches, and nothing newer", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 8 * 24 * 60 * 60_000);
    const fresh = new Date(now.getTime() - 6 * 24 * 60 * 60_000);
    const make = (i: number, createdAt: Date) => ({
      idempotencyKey: `ret-${createdAt === old ? "old" : "new"}-${i}`,
      kind: "dm",
      body: "text",
      status: "sent",
      createdAt,
    });
    await prisma.messagingOutbound.createMany({
      data: [
        ...Array.from({ length: 1005 }, (_, i) => make(i, old)),
        ...Array.from({ length: 3 }, (_, i) => make(i, fresh)),
      ],
    });
    await prisma.messagingInboundClaim.createMany({
      data: [
        { key: "ret-old", createdAt: old },
        { key: "ret-new", createdAt: fresh },
      ],
    });
    const result = await deleteExpiredMessagingTransport(prisma, now);
    expect(result.outbound).toBeGreaterThanOrEqual(1005);
    expect(
      await prisma.messagingOutbound.count({
        where: { idempotencyKey: { startsWith: "ret-old" } },
      }),
    ).toBe(0);
    expect(
      await prisma.messagingOutbound.count({
        where: { idempotencyKey: { startsWith: "ret-new" } },
      }),
    ).toBe(3);
    expect(await prisma.messagingInboundClaim.count({ where: { key: "ret-old" } })).toBe(0);
    expect(await prisma.messagingInboundClaim.count({ where: { key: "ret-new" } })).toBe(1);
  });
});
