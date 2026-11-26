import type { PrismaClient } from "@rakazo/db";
import { claimDuePageSources, createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_REFRESHES_PER_SPACE_PER_DAY,
  runPageRefreshTick,
  runPageSnapshotRetention,
} from "./page-source-tick.js";
import {
  pageSourceToolFromTool,
  resolveBlocksPageData,
  updatePageSourceByOwner,
} from "./page-sources.js";
import { createBotPage, saveBotPage } from "./pages.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describePostgres("page source scheduler (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `pst-org-${suffix}`;
  const spaceId = `pst-space-${suffix}`;
  const userId = `pst-user-${suffix}`;
  const sendUserMessage = vi.fn(async () => ({ taskId: "t", runId: "r" }));
  const events = { append: vi.fn(async () => ({}) as never), sendUserMessage };
  const jobs = { enqueue: vi.fn(async () => {}) };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let pageId: string;
  let clock = new Date("2030-03-04T10:00:00Z");
  let seq = 0;

  const tick = (random = () => 0.5) =>
    runPageRefreshTick({
      prisma,
      events: events as never,
      jobs: jobs as never,
      now: () => clock,
      random,
    });
  /** A due source; `tool` decides whether a refresh succeeds (contacts_list) or fails (fundraising_read). */
  const makeSource = (data: Record<string, unknown> = {}) =>
    prisma.pageSource.create({
      data: {
        spaceId,
        userId,
        botId,
        pageId,
        name: `s${seq++}`,
        kind: "praci",
        call: { tool: "contacts_list", args: {} },
        schedule: "1h",
        status: "active",
        nextRefreshAt: new Date(clock.getTime() - MINUTE),
        ...data,
      },
    });
  const failing = { call: { tool: "fundraising_read", args: {} } };
  const row = (id: string) => prisma.pageSource.findFirstOrThrow({ where: { id } });

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
      data: { id: organizationId, name: "PST Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: "General" } });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "Chief", color: "blue" } }))
      .id;
    await prisma.thread.create({ data: { spaceId, userId, botId } });
    pageId = (await createBotPage({ prisma, events }, { spaceId, botId, userId, title: "Cash" }))
      .id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });
  beforeEach(async () => {
    sendUserMessage.mockClear();
    clock = new Date("2030-03-04T10:00:00Z");
    await prisma.pageSource.deleteMany({ where: { spaceId } });
  });

  it("two concurrent claims never return the same source", async () => {
    for (let i = 0; i < 12; i++) await makeSource();
    // Other test files share this database, so count only this Space's rows.
    const [a, b] = await Promise.all([
      claimDuePageSources(prisma, clock, 200),
      claimDuePageSources(prisma, clock, 200),
    ]);
    const ids = [...a, ...b].filter((claim) => claim.spaceId === spaceId).map((claim) => claim.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("reclaims an expired lease, skips a live one, and never claims paused, pending, denied or future rows", async () => {
    const live = await makeSource({ leaseUntil: new Date(clock.getTime() + 5 * MINUTE) });
    const expired = await makeSource({ leaseUntil: new Date(clock.getTime() - MINUTE) });
    for (const status of ["paused", "pending", "denied"]) await makeSource({ status });
    await makeSource({ nextRefreshAt: new Date(clock.getTime() + MINUTE) });
    const claimed = (await claimDuePageSources(prisma, clock, 200))
      .filter((claim) => claim.spaceId === spaceId)
      .map((claim) => claim.id);
    expect(claimed).toEqual([expired.id]);
    expect(claimed).not.toContain(live.id);
    expect((await row(expired.id)).leaseUntil?.getTime()).toBe(clock.getTime() + 10 * MINUTE);
  });

  it("a successful refresh stores a snapshot, clears the lease and schedules within 5% jitter", async () => {
    const source = await makeSource({ schedule: "1h" });
    await tick(() => 1);
    const after = await row(source.id);
    expect(after.leaseUntil).toBeNull();
    expect(after.failures).toBe(0);
    expect(after.nextRefreshAt?.getTime()).toBe(clock.getTime() + HOUR * 1.05);
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: source.id } })).toBe(1);
    await tick();
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: source.id } })).toBe(1);
  });

  it("backs off after failures, never below the interval or above 6 hours, and keeps the last snapshot", async () => {
    const fast = await makeSource({ ...failing, schedule: "15m" });
    await prisma.pageSourceSnapshot.create({
      data: { spaceId, sourceId: fast.id, value: { ok: 1 }, bytes: 1, fetchedAt: clock },
    });
    const slow = await makeSource({ ...failing, schedule: "1d" });
    await tick();
    expect((await row(fast.id)).nextRefreshAt?.getTime()).toBe(clock.getTime() + 30 * MINUTE);
    expect((await row(slow.id)).nextRefreshAt?.getTime()).toBe(clock.getTime() + 24 * HOUR);
    await prisma.pageSource.update({
      where: { id: fast.id },
      data: { failures: 3, nextRefreshAt: new Date(clock.getTime() - MINUTE) },
    });
    const hourly = await makeSource({ ...failing, schedule: "1h", failures: 2 });
    await tick();
    expect((await row(fast.id)).nextRefreshAt?.getTime()).toBe(clock.getTime() + 4 * HOUR);
    expect((await row(hourly.id)).nextRefreshAt?.getTime()).toBe(clock.getTime() + 6 * HOUR);
    expect((await row(fast.id)).leaseUntil).toBeNull();
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: fast.id } })).toBe(1);
  });

  it("pauses on the fifth failure and posts exactly one message to the bot's thread", async () => {
    const source = await makeSource({ ...failing, name: "Revenue", failures: 4 });
    await tick();
    const paused = await row(source.id);
    expect(paused).toMatchObject({ status: "paused", failures: 5 });
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(sendUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        botId,
        // Fixed words: nothing the bot or a remote server wrote reaches an owner-trusted message.
        prompt:
          "A source on one of your pages stopped working. Call page_source_list to see which one and why.",
      }),
    );
    expect(jobs.enqueue).toHaveBeenCalled();
    clock = new Date(clock.getTime() + 7 * 24 * HOUR);
    await tick();
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
  });

  it("over the daily budget, waits until the next UTC midnight without counting a failure", async () => {
    const source = await makeSource();
    await prisma.$executeRaw`
      INSERT INTO "page_source_snapshots" ("id","spaceId","sourceId","fetchedAt","value","bytes")
      SELECT 'bud-' || ${suffix} || '-' || g, ${spaceId}, ${source.id}, ${clock}, '{}'::jsonb, 2
      FROM generate_series(1, ${PAGE_REFRESHES_PER_SPACE_PER_DAY}) g`;
    await tick();
    const after = await row(source.id);
    expect(after.nextRefreshAt?.toISOString()).toBe("2030-03-05T00:00:00.000Z");
    expect(after).toMatchObject({ leaseUntil: null, failures: 0 });
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: source.id } })).toBe(
      PAGE_REFRESHES_PER_SPACE_PER_DAY,
    );
  });

  it("retention drops snapshots over 400 days old and keeps the newest 2,000 per source", async () => {
    const a = await makeSource({ status: "paused" });
    const b = await makeSource({ status: "paused" });
    await prisma.$executeRaw`
      INSERT INTO "page_source_snapshots" ("id","spaceId","sourceId","fetchedAt","value","bytes")
      SELECT 'ret-' || ${suffix} || '-' || s.id || '-' || g, ${spaceId}, s.id,
        ${clock}::timestamp - (g || ' minutes')::interval, '{}'::jsonb, 2
      FROM generate_series(1, 2100) g, (VALUES (${a.id}), (${b.id})) AS s(id)`;
    await prisma.pageSourceSnapshot.create({
      data: {
        spaceId,
        sourceId: b.id,
        value: {},
        bytes: 2,
        fetchedAt: new Date(clock.getTime() - 401 * 24 * HOUR),
      },
    });
    await runPageSnapshotRetention(prisma);
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: a.id } })).toBe(2000);
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: b.id } })).toBe(2000);
    const newest = await prisma.pageSourceSnapshot.findFirstOrThrow({
      where: { sourceId: a.id },
      orderBy: { fetchedAt: "asc" },
    });
    expect(clock.getTime() - newest.fetchedAt.getTime()).toBe(2000 * MINUTE);
  });

  it("a history chart reads at most the newest 500 snapshots", async () => {
    const source = await makeSource({ name: "Cash", status: "paused" });
    await prisma.$executeRaw`
      INSERT INTO "page_source_snapshots" ("id","spaceId","sourceId","fetchedAt","value","bytes")
      SELECT 'his-' || ${suffix} || '-' || g, ${spaceId}, ${source.id},
        ${clock}::timestamp - (g || ' minutes')::interval, jsonb_build_object('n', g), 2
      FROM generate_series(1, 800) g`;
    const spec = { marks: [{ type: "lineY", options: { x: "at", y: "value" } }] };
    const content = [
      "```chart",
      JSON.stringify({
        name: "History",
        spec,
        data: [{ at: "2026-09-01", value: 1 }],
        source: "Cash",
        path: "/n",
        over: "history",
      }),
      "```",
    ].join("\n");
    const current = await prisma.botPage.findFirstOrThrow({ where: { id: pageId } });
    const saved = await saveBotPage(
      { prisma, events },
      { spaceId, botId, userId, pageId, content, baseRevision: current.revision, updatedBy: "bot" },
    );
    expect(saved.ok).toBe(true);
    const page = await prisma.botPage.findFirstOrThrow({ where: { id: pageId } });
    const data = await resolveBlocksPageData({ prisma }, { spaceId }, page);
    const rows = (data.blocks[0]?.rows ?? []) as { value: number }[];
    expect(rows).toHaveLength(500);
    // Oldest first, ending with the newest snapshot.
    expect(rows[499]?.value).toBe(1);
    expect(rows[0]?.value).toBe(500);
  });

  it("refuses the 101st active source in a space", async () => {
    // 20 sources per page is the page cap, so spread them over five other pages.
    const pageIds = await Promise.all(
      [1, 2, 3, 4, 5].map(
        async (n) =>
          (await createBotPage({ prisma, events }, { spaceId, botId, userId, title: `Cap ${n}` }))
            .id,
      ),
    );
    await prisma.pageSource.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({
        spaceId,
        userId,
        botId,
        pageId: pageIds[i % 5] as string,
        name: `cap${i}`,
        kind: "praci",
        call: { tool: "contacts_list", args: {} },
        schedule: "1d",
        status: "active",
      })),
    });
    const result = await pageSourceToolFromTool(
      "page_source_set",
      { prisma, events },
      { spaceId, botId, userId, runId: "run-1" },
      { name: "extra", tool: "contacts_list" },
    );
    expect(result).toMatchObject({ error: expect.stringContaining("100 active sources") });
  });

  it("owner changes: schedule recomputes the next run, pause and resume, other bots not found", async () => {
    const source = await makeSource({ failures: 5, status: "paused" });
    const deps = { prisma, events, now: () => clock, random: () => 0 };
    const scope = { spaceId, botId };
    const resumed = await updatePageSourceByOwner(deps, scope, source.id, { action: "resume" });
    expect(resumed?.status).toBe("active");
    expect(await row(source.id)).toMatchObject({ failures: 0, nextRefreshAt: clock });
    await updatePageSourceByOwner(deps, scope, source.id, { schedule: "1d" });
    expect((await row(source.id)).nextRefreshAt?.getTime()).toBe(clock.getTime() + 24 * HOUR);
    expect(
      (await updatePageSourceByOwner(deps, scope, source.id, { action: "pause" }))?.status,
    ).toBe("paused");
    expect(
      await updatePageSourceByOwner(deps, { spaceId, botId: "other-bot" }, source.id, {
        action: "resume",
      }),
    ).toBeNull();
    const denied = await makeSource({ status: "denied" });
    expect(
      (await updatePageSourceByOwner(deps, scope, denied.id, { action: "resume" }))?.status,
    ).toBe("denied");
  });
});
