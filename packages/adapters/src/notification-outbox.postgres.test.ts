import type {
  NotificationChannel,
  NotificationEndpointRef,
  NotificationEnvelope,
  NotificationSendResult,
} from "@rakazo/adapter-kit";
import { createDb, createNotification, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deliverDueNotifications,
  OUTBOX_MAX_ATTEMPTS,
  outboxBackoffMs,
} from "./notification-outbox.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

class FakeChannel implements NotificationChannel {
  readonly channel = "push";
  sent: { envelope: NotificationEnvelope; endpoint: NotificationEndpointRef }[] = [];
  result: (endpoint: NotificationEndpointRef) => NotificationSendResult | Error = () => "sent";
  describe() {
    return {
      id: "fake",
      contractVersion: "1",
      adapterVersion: "0",
      capabilities: { push: true, email: false },
    };
  }
  async send(envelope: NotificationEnvelope, endpoint: NotificationEndpointRef) {
    const result = this.result(endpoint);
    if (result instanceof Error) throw result;
    if (result === "sent") this.sent.push({ envelope, endpoint });
    return result;
  }
}

describePostgres("notification outbox (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `ob-org-${suffix}`;
  const spaceId = `ob-space-${suffix}`;
  const userId = `ob-user-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;
  const T0 = new Date("2030-01-01T00:00:00Z");
  const at = (ms: number) => new Date(T0.getTime() + ms);

  /** An attention notification created at T0 with one pending push delivery due at T0 + 30s. */
  const attention = async () => {
    const result = await createNotification(prisma, {
      spaceId,
      userId,
      botId: `bot-${++n}`,
      surface: "finance",
      title: `Needs you ${n}`,
      importance: "attention",
      now: T0,
    });
    if (result.status !== "created") throw new Error("expected created");
    return result.notification;
  };
  const delivery = (notificationId: string) =>
    prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId } });

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
      data: { id: organizationId, name: "OB Org", slug: organizationId, createdAt: new Date() },
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

  it("does not send before the delivery is due", async () => {
    const note = await attention();
    const channel = new FakeChannel();
    await deliverDueNotifications({ prisma, channels: [channel], now: at(10_000) });
    expect(channel.sent).toHaveLength(0);
    expect((await delivery(note.id)).status).toBe("pending");
    await prisma.notification.delete({ where: { id: note.id } });
  });

  it("sends once when two workers run at the same time", async () => {
    const note = await attention();
    const channel = new FakeChannel();
    const results = await Promise.all([
      deliverDueNotifications({ prisma, channels: [channel], now: at(31_000) }),
      deliverDueNotifications({ prisma, channels: [channel], now: at(31_000) }),
    ]);
    expect(channel.sent.filter((s) => s.envelope.id === note.id)).toHaveLength(1);
    expect(results.reduce((sum, r) => sum + r.sent, 0)).toBeGreaterThanOrEqual(1);
    expect((await delivery(note.id)).status).toBe("sent");
    await deliverDueNotifications({ prisma, channels: [channel], now: at(10 * 60_000) });
    expect(channel.sent.filter((s) => s.envelope.id === note.id)).toHaveLength(1);
  });

  it("skips a notification the user already saw or was shown", async () => {
    const shown = await attention();
    const seen = await attention();
    await prisma.notification.update({ where: { id: shown.id }, data: { shownAt: at(5_000) } });
    await prisma.notification.update({ where: { id: seen.id }, data: { seenAt: at(5_000) } });
    const channel = new FakeChannel();
    await deliverDueNotifications({ prisma, channels: [channel], now: at(31_000) });
    expect(channel.sent.map((s) => s.envelope.id)).not.toContain(shown.id);
    expect(channel.sent.map((s) => s.envelope.id)).not.toContain(seen.id);
    expect((await delivery(shown.id)).status).toBe("skipped");
    expect((await delivery(seen.id)).status).toBe("skipped");
  });

  it("retries with backoff and gives up after five attempts", async () => {
    const note = await attention();
    const channel = new FakeChannel();
    channel.result = () => new Error("vendor down");
    let now = at(31_000);
    for (let attempt = 1; attempt < OUTBOX_MAX_ATTEMPTS; attempt += 1) {
      await deliverDueNotifications({ prisma, channels: [channel], now });
      const row = await delivery(note.id);
      expect(row).toMatchObject({ status: "pending", attempts: attempt, lastError: "vendor down" });
      expect(row.nextAttemptAt.getTime()).toBe(now.getTime() + outboxBackoffMs(attempt));
      // Not due again before the backoff ends.
      await deliverDueNotifications({
        prisma,
        channels: [channel],
        now: new Date(now.getTime() + 1_000),
      });
      expect((await delivery(note.id)).attempts).toBe(attempt);
      now = row.nextAttemptAt;
    }
    await deliverDueNotifications({ prisma, channels: [channel], now });
    expect(await delivery(note.id)).toMatchObject({
      status: "failed",
      attempts: OUTBOX_MAX_ATTEMPTS,
    });
  });

  it("deletes endpoints the channel reports gone and sends to the rest", async () => {
    await prisma.notificationEndpoint.create({
      data: { userId, channel: "push", address: "ExponentPushToken[dead]", deviceId: "dead" },
    });
    const note = await attention();
    const channel = new FakeChannel();
    channel.result = (endpoint) => (endpoint.address.includes("dead") ? "endpointGone" : "sent");
    await deliverDueNotifications({ prisma, channels: [channel], now: at(31_000) });
    expect((await delivery(note.id)).status).toBe("sent");
    const remaining = await prisma.notificationEndpoint.findMany({ where: { userId } });
    expect(remaining.map((e) => e.deviceId)).toEqual(["a"]);
  });

  it("marks a delivery skipped when every endpoint is gone", async () => {
    const note = await attention();
    const channel = new FakeChannel();
    channel.result = () => "endpointGone";
    await deliverDueNotifications({ prisma, channels: [channel], now: at(31_000) });
    expect((await delivery(note.id)).status).toBe("skipped");
    expect(await prisma.notificationEndpoint.count({ where: { userId } })).toBe(0);
  });
});
