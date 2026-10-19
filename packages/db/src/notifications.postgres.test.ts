import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  createNotification,
  deleteExpiredNotifications,
  listNotifications,
  markSeen,
  markShown,
  NotificationValidationError,
  unseenCounts,
} from "./notifications.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const HOUR = 60 * 60 * 1000;

describePostgres("notifications (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `notif-org-${suffix}`;
  const mine = { spaceId: `notif-space-a-${suffix}`, userId: `notif-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `notif-user-b-${suffix}` };
  const otherSpace = { spaceId: `notif-space-b-${suffix}`, userId: mine.userId };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;
  const next = () => {
    n += 1;
    return n;
  };
  const title = () => `Title ${next()}`;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [mine.userId, sameSpace.userId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Notif Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({ id, organizationId, name: id })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, sameSpace.userId] } } });
    await close();
  });

  const base = (extra: Record<string, unknown> = {}) => ({
    ...mine,
    botId: `bot-${next()}`,
    surface: "inbox",
    title: title(),
    ...extra,
  });

  it("creates, dedupes within 24 hours, and notifies again after", async () => {
    const input = base({ title: "Same thing" });
    const t0 = new Date();
    const first = await createNotification(prisma, { ...input, now: t0 });
    expect(first.status).toBe("created");
    const again = await createNotification(prisma, {
      ...input,
      now: new Date(t0.getTime() + 23 * HOUR),
    });
    expect(again.status).toBe("deduped");
    const later = await createNotification(prisma, {
      ...input,
      now: new Date(t0.getTime() + 25 * HOUR),
    });
    expect(later.status).toBe("created");
    // Another agent with the same title is not a duplicate.
    expect((await createNotification(prisma, base({ title: "Same thing" }))).status).toBe(
      "created",
    );
  });

  it("creates one row for concurrent identical calls", async () => {
    const input = base({ dedupeKey: "race" });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => createNotification(prisma, input)),
    );
    expect(results.filter((r) => r.status === "created")).toHaveLength(1);
    expect(await prisma.notification.count({ where: { botId: input.botId } })).toBe(1);
  });

  it("limits info to 5 per hour and 20 per day per agent and user", async () => {
    const botId = `bot-limit-${suffix}`;
    const t0 = new Date();
    for (let i = 0; i < 5; i += 1) {
      const r = await createNotification(prisma, {
        ...mine,
        botId,
        surface: "x",
        title: `h${i}`,
        now: t0,
      });
      expect(r.status).toBe("created");
    }
    expect(
      (await createNotification(prisma, { ...mine, botId, surface: "x", title: "h5", now: t0 }))
        .status,
    ).toBe("rateLimited");
    // The hourly window moves; the daily one fills at 20.
    for (let i = 0; i < 15; i += 1) {
      const at = new Date(t0.getTime() + (i + 1) * 70 * 60 * 1000);
      const r = await createNotification(prisma, {
        ...mine,
        botId,
        surface: "x",
        title: `d${i}`,
        now: at,
      });
      expect(r.status).toBe("created");
    }
    const at = new Date(t0.getTime() + 17 * HOUR);
    expect(
      (await createNotification(prisma, { ...mine, botId, surface: "x", title: "d-over", now: at }))
        .status,
    ).toBe("rateLimited");
    // Another user of the same agent id is counted separately.
    expect(
      (await createNotification(prisma, { ...sameSpace, botId, surface: "x", title: "h0" })).status,
    ).toBe("created");
  });

  it("limits attention to 2 per hour and queues deliveries only for attention", async () => {
    await prisma.notificationEndpoint.create({
      data: { userId: mine.userId, channel: "push", address: "tok-a", deviceId: "dev-a" },
    });
    await prisma.notificationEndpoint.create({
      data: { userId: mine.userId, channel: "slack", address: "u1", deviceId: "dev-s" },
    });
    await prisma.notificationPreference.create({
      data: { spaceId: mine.spaceId, userId: mine.userId, channels: { slack: false } },
    });
    const botId = `bot-att-${suffix}`;
    const t0 = new Date();
    const info = await createNotification(prisma, {
      ...mine,
      botId,
      surface: "x",
      title: "i",
      now: t0,
    });
    const a1 = await createNotification(prisma, {
      ...mine,
      botId,
      surface: "x",
      title: "a1",
      importance: "attention",
      now: t0,
    });
    const a2 = await createNotification(prisma, {
      ...mine,
      botId,
      surface: "x",
      title: "a2",
      importance: "attention",
      now: t0,
    });
    const a3 = await createNotification(prisma, {
      ...mine,
      botId,
      surface: "x",
      title: "a3",
      importance: "attention",
      now: t0,
    });
    expect([info.status, a1.status, a2.status, a3.status]).toEqual([
      "created",
      "created",
      "created",
      "rateLimited",
    ]);
    if (info.status !== "created" || a1.status !== "created") throw new Error("unreachable");
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: info.notification.id } }),
    ).toBe(0);
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notificationId: a1.notification.id },
    });
    expect(deliveries.map((d) => [d.channel, d.status])).toEqual([["push", "pending"]]);
    expect(deliveries[0]!.nextAttemptAt.getTime()).toBe(t0.getTime() + 30_000);
    // A user without endpoints gets no delivery.
    const other = await createNotification(prisma, {
      ...sameSpace,
      botId,
      surface: "x",
      title: "a",
      importance: "attention",
    });
    if (other.status !== "created") throw new Error("unreachable");
    expect(
      await prisma.notificationDelivery.count({ where: { notificationId: other.notification.id } }),
    ).toBe(0);
  });

  it("validates lengths and requires an in-app link", async () => {
    const bad = (extra: Record<string, unknown>) =>
      expect(createNotification(prisma, base(extra))).rejects.toBeInstanceOf(
        NotificationValidationError,
      );
    await bad({ title: "x".repeat(81) });
    await bad({ title: "  " });
    await bad({ body: "x".repeat(201) });
    for (const link of [
      "https://evil.test/x",
      "//evil.test",
      "/\\evil.test",
      "javascript:alert(1)",
      "inbox",
      "/a\nb",
    ]) {
      await bad({ link });
    }
    const ok = await createNotification(
      prisma,
      base({ link: "/inbox?x=1", body: "x".repeat(200) }),
    );
    expect(ok.status).toBe("created");
  });

  it("scopes list, markSeen, markShown and counts to space and user", async () => {
    const ctx = { spaceId: `iso-${suffix}`, userId: sameSpace.userId };
    await prisma.space.create({ data: { id: ctx.spaceId, organizationId, name: ctx.spaceId } });
    const botId = `bot-iso-${suffix}`;
    const t0 = new Date();
    const mk = (who: { spaceId: string; userId: string }, surface: string, t: string) =>
      createNotification(prisma, { ...who, botId, surface, title: t, now: t0 });
    const a = await mk(mine, "legal", "mine-legal");
    await mk(mine, "legal", "mine-legal-2");
    await mk(mine, "finance", "mine-fin");
    await mk(sameSpace, "legal", "peer-legal");
    await mk(otherSpace, "legal", "other-space");
    await mk(ctx, "legal", "ctx-legal");
    const own = (await listNotifications(prisma, { ...mine })).filter((x) => x.botId === botId);
    expect(own.map((x) => x.title).sort()).toEqual(["mine-fin", "mine-legal", "mine-legal-2"]);
    const since = (ms: number) =>
      listNotifications(prisma, { ...mine, since: new Date(t0.getTime() + ms) });
    expect((await since(-1)).filter((x) => x.botId === botId)).toHaveLength(3);
    expect((await since(1)).filter((x) => x.botId === botId)).toEqual([]);
    expect((await unseenCounts(prisma, mine)).legal).toBe(2);
    expect(await markSeen(prisma, { ...mine, surface: "legal" })).toBe(2);
    expect((await unseenCounts(prisma, mine)).legal).toBeUndefined();
    expect((await unseenCounts(prisma, mine)).finance).toBe(1);
    // The peer, the other space and the third space still have theirs.
    expect((await unseenCounts(prisma, sameSpace)).legal).toBe(1);
    expect((await unseenCounts(prisma, otherSpace)).legal).toBeGreaterThanOrEqual(1);
    expect((await unseenCounts(prisma, ctx)).legal).toBe(1);
    if (a.status !== "created") throw new Error("unreachable");
    expect(await markShown(prisma, sameSpace, a.notification.id)).toBe(false);
    expect(await markShown(prisma, mine, a.notification.id)).toBe(true);
    expect(
      (await prisma.notification.findUnique({ where: { id: a.notification.id } }))?.shownAt,
    ).not.toBeNull();
  });

  it("deletes notifications after 30 days and deliveries after 7", async () => {
    const old = new Date(Date.now() - 31 * 24 * HOUR);
    const mid = new Date(Date.now() - 8 * 24 * HOUR);
    const botId = `bot-ret-${suffix}`;
    const mk = (createdAt: Date, t: string) =>
      prisma.notification.create({
        data: { ...mine, botId, surface: "x", title: t, dedupeKey: t, createdAt },
      });
    const oldN = await mk(old, "old");
    const midN = await mk(mid, "mid");
    const fresh = await mk(new Date(), "fresh");
    for (const row of [midN, fresh]) {
      await prisma.notificationDelivery.create({
        data: {
          notificationId: row.id,
          channel: "push",
          nextAttemptAt: new Date(),
          createdAt: row.createdAt,
        },
      });
    }
    await deleteExpiredNotifications(prisma);
    const left = await prisma.notification.findMany({ where: { botId } });
    expect(left.map((x) => x.title).sort()).toEqual(["fresh", "mid"]);
    expect(oldN.id).not.toBe(midN.id);
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notificationId: { in: [midN.id, fresh.id] } },
    });
    expect(deliveries.map((d) => d.notificationId)).toEqual([fresh.id]);
  });
});
