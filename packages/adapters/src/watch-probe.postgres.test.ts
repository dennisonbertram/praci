import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createWatchFromTool, listSchedulesFromTool, scheduleApproval } from "./schedule-tools.js";
import { runWatchProbeTick } from "./watch-probe.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("page watches (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `wp-org-${suffix}`;
  const spaceId = `wp-space-${suffix}`;
  const userId = `wp-user-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;
  const jobs = { enqueue: vi.fn(async () => {}), cancel: vi.fn(async () => {}) };
  const events = { append: vi.fn(async () => {}) };
  const deps = () =>
    ({ prisma, events, jobs }) as unknown as Parameters<typeof createWatchFromTool>[0];

  let body = "<p>Plan A costs $10</p>";
  let status = 200;
  const fetchStub = (async () => new Response(body, { status })) as typeof fetch;
  const resolveHostname = async () => [{ address: "203.0.113.10", family: 4 as const }];
  let clock = new Date();
  const tick = () => {
    clock = new Date(clock.getTime() + 24 * 60 * 60_000);
    return runWatchProbeTick({
      prisma,
      jobs: jobs as never,
      events: events as never,
      fetch: fetchStub,
      resolveHostname,
      now: () => clock,
    });
  };

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
      data: { id: orgId, name: "WP Org", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: spaceId } });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "A", color: "blue" } })).id;
    threadId = (await prisma.thread.create({ data: { spaceId, userId, botId } })).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("watch_create makes a quiet watch behind the repeating-schedule card", async () => {
    const args = {
      url: "https://example.test/pricing",
      intervalMinutes: 60,
      name: "Pricing",
      instruction: "Tell me what changed, then stop.",
    };
    const card = await scheduleApproval(
      deps(),
      { spaceId, botId, userId },
      "watch_create",
      args,
      "UTC",
    );
    expect(card?.summary).toBe(
      "Checks example.test/pricing every hour and tells you only when it changes",
    );
    expect(
      await scheduleApproval(
        deps(),
        { spaceId, botId, userId },
        "watch_create",
        { ...args, url: "nope" },
        "UTC",
      ),
    ).toBeUndefined();

    const created = await createWatchFromTool(deps(), {
      spaceId,
      botId,
      userId,
      threadId,
      ...args,
    });
    expect(created).toMatchObject({ ok: true, watch: { kind: "page", intervalMinutes: 60 } });
    const row = await prisma.routine.findFirstOrThrow({
      where: { spaceId, name: "Pricing" },
      include: { watchState: true },
    });
    expect(row).toMatchObject({ quiet: true, active: true, crons: [] });
    expect(row.watchState).not.toBeNull();
    const listed = await listSchedulesFromTool(deps(), { spaceId, botId, userId });
    expect(listed.routines[0]).toMatchObject({ watch: { url: args.url }, pausedReason: null });
    expect(
      await createWatchFromTool(deps(), {
        spaceId,
        botId,
        userId,
        threadId,
        ...args,
        url: "ftp://x",
      }),
    ).toHaveProperty("error");
  });

  it("baseline, unchanged, changed (one tainted unattended run), then 5 errors pause with one notification", async () => {
    const routine = await prisma.routine.findFirstOrThrow({ where: { spaceId, name: "Pricing" } });
    const runs = () => prisma.run.findMany({ where: { routineId: routine.id } });

    expect(await tick()).toMatchObject({ checked: 1, woke: 0 });
    expect(await runs()).toHaveLength(0);
    expect(await tick()).toMatchObject({ checked: 1, woke: 0 });
    expect(await runs()).toHaveLength(0);

    body = "<p>Plan A costs $12</p>";
    expect(await tick()).toMatchObject({ checked: 1, woke: 1 });
    const [run] = await runs();
    expect(run).toMatchObject({
      trigger: "routine",
      unattended: true,
      externalTaint: true,
      status: "queued",
    });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: run!.taskId } });
    expect(task.prompt).toContain("Tell me what changed, then stop.");
    expect(task.prompt).toContain("The watched page changed (https://example.test/pricing)");
    expect(task.prompt).toContain("<untrusted_delivery_payload>");
    expect(task.prompt).toContain("$12");

    // The run is still queued, so a further change folds in instead of waking again.
    body = "<p>Plan A costs $15</p>";
    expect(await tick()).toMatchObject({ checked: 1, woke: 0 });
    expect(await runs()).toHaveLength(1);

    status = 503;
    for (let i = 0; i < 4; i++) expect(await tick()).toMatchObject({ paused: 0 });
    expect(await tick()).toMatchObject({ paused: 1 });
    expect(await tick()).toMatchObject({ checked: 0 });
    const notes = await prisma.notification.findMany({ where: { spaceId, routineId: routine.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.title).toBe("Pricing paused: the page could not be checked");
  });
});
