import { createDb, createNotificationEvents, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defaultNotificationSurface, runNotifyUser } from "./notify-user.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describe("defaultNotificationSurface", () => {
  it("maps page agents to their page and others to the thread", () => {
    expect(defaultNotificationSurface("inbox-agent:u")).toBe("inbox");
    expect(defaultNotificationSurface("finance-agent:u")).toBe("finance");
    expect(defaultNotificationSurface("legal-agent:u")).toBe("legal");
    expect(defaultNotificationSurface("carta-agent:u")).toBe("cap-table");
    expect(defaultNotificationSurface(null)).toBe("thread");
    expect(defaultNotificationSurface("integration-agent:x")).toBe("thread");
  });
});

describePostgres("notify_user (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `nu-org-${suffix}`;
  const spaceId = `nu-space-${suffix}`;
  const userId = `nu-user-${suffix}`;
  const otherUserId = `nu-other-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;
  const run = (over: Partial<{ routineId: string | null; userId: string }> = {}) => ({
    id: `run-${++n}`,
    spaceId,
    userId,
    threadId: "thread-1",
    routineId: null,
    ...over,
  });
  const bot = (spawnKey: string | null = null, id = `bot-${suffix}-${spawnKey ?? "plain"}`) => ({
    id,
    spawnKey,
  });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [userId, otherUserId].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "NU Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("stores the notification for the run's own user and signals after commit", async () => {
    const notify = vi.fn(async () => {});
    const result = await runNotifyUser(
      prisma,
      { notify, follow: vi.fn() },
      run(),
      bot("finance-agent:u"),
      // userId in args is ignored: the recipient is never chosen by the agent.
      {
        title: "Runway dropped",
        importance: "attention",
        userId: otherUserId,
        link: "/app/finance",
      },
    );
    expect(result).toEqual({ ok: true, note: "Notification sent." });
    const rows = await prisma.notification.findMany({
      where: { spaceId, title: "Runway dropped" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId, surface: "finance", importance: "attention" });
    expect(notify).toHaveBeenCalledWith(
      { spaceId, userId },
      { id: rows[0]?.id, surface: "finance", importance: "attention" },
    );
  });

  it("falls back to the thread surface and reports dedupe and rate limits to the model", async () => {
    const first = await runNotifyUser(prisma, undefined, run(), bot(), { title: "Same thing" });
    expect(first).toMatchObject({ ok: true });
    const again = await runNotifyUser(prisma, undefined, run(), bot(), { title: "Same thing" });
    expect(again).toEqual({ ok: true, note: "Already notified recently; nothing sent." });
    const row = await prisma.notification.findFirst({ where: { spaceId, title: "Same thing" } });
    expect(row).toMatchObject({ surface: "thread", threadId: "thread-1" });

    // Four more distinct ones make five, the per hour limit for this agent.
    for (const t of ["a", "b", "c", "d"]) {
      await runNotifyUser(prisma, undefined, run(), bot(), { title: t });
    }
    const limited = await runNotifyUser(prisma, undefined, run(), bot(), { title: "one more" });
    expect(limited).toEqual({ error: "Rate limited, do not retry." });
  });

  it("returns validation errors to the model", async () => {
    const result = await runNotifyUser(prisma, undefined, run(), bot("legal-agent:u"), {
      title: "x".repeat(81),
    });
    expect(result).toMatchObject({ error: expect.stringContaining("title") });
    const bad = await runNotifyUser(prisma, undefined, run(), bot("legal-agent:u"), {
      title: "ok",
      link: "https://evil.example",
    });
    expect(bad).toMatchObject({ error: expect.stringContaining("in-app path") });
  });

  it("keeps the dot but downgrades to info when the routine has notify off", async () => {
    const withRoutine = new Proxy(prisma, {
      get: (target, key) =>
        key === "routine"
          ? { findUnique: async () => ({ notify: false }) }
          : Reflect.get(target, key, target),
    }) as PrismaClient;
    await prisma.notificationEndpoint.create({
      data: { userId, channel: "push", address: "ExponentPushToken[x]", deviceId: "d1" },
    });
    const result = await runNotifyUser(
      withRoutine,
      createNotificationEvents(),
      run({ routineId: "routine-1" }),
      bot("inbox-agent:u"),
      { title: "Quiet routine", importance: "attention" },
    );
    expect(result).toMatchObject({ ok: true });
    const row = await prisma.notification.findFirstOrThrow({
      where: { spaceId, title: "Quiet routine" },
      include: { deliveries: true },
    });
    expect(row).toMatchObject({ surface: "inbox", importance: "info", routineId: "routine-1" });
    expect(row.deliveries).toHaveLength(0);
    await prisma.notificationEndpoint.deleteMany({ where: { userId } });
  });
});
