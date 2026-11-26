import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  claimDueWatchChecks,
  countWatches,
  getCheckInCadence,
  recordWatchCheck,
  resumeWatch,
  spaceWatchWakesToday,
  syncWatchState,
  upsertCheckInRoutine,
} from "./routine-watch.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("routine watches and check-ins (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = { user: `rw-user-${suffix}`, org: `rw-org-${suffix}`, space: `rw-space-${suffix}` };
  const otherSpace = `rw-other-${suffix}`;
  const watch = { kind: "page", url: "https://example.com/p", intervalMinutes: 60 } as const;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let otherBotId: string;
  const t0 = new Date("2026-03-01T12:00:00Z");
  const min = (n: number) => new Date(t0.getTime() + n * 60_000);

  async function newWatch(bot = botId, space = ids.space) {
    const routine = await prisma.routine.create({
      data: {
        spaceId: space,
        botId: bot,
        userId: ids.user,
        name: "w",
        crons: [],
        prompt: "p",
        active: true,
        quiet: true,
        timezone: "UTC",
        watch,
      },
    });
    await syncWatchState(prisma, {
      routineId: routine.id,
      spaceId: space,
      watch,
      watchChanged: true,
      now: t0,
    });
    return routine.id;
  }

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: ids.user, name: ids.user, email: `${ids.user}@example.test` },
    });
    await prisma.organization.create({
      data: { id: ids.org, name: "Org", slug: ids.org, createdAt: new Date() },
    });
    for (const id of [ids.space, otherSpace]) {
      await prisma.space.create({
        data: { id, organizationId: ids.org, name: id, isDefault: id === ids.space },
      });
    }
    botId = (
      await prisma.bot.create({
        data: { spaceId: ids.space, userId: ids.user, name: "a", color: "blue" },
      })
    ).id;
    otherBotId = (
      await prisma.bot.create({
        data: { spaceId: otherSpace, userId: ids.user, name: "b", color: "blue" },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await close();
  });

  it("claims a due watch once, even when two workers race", async () => {
    const id = await newWatch();
    const [a, b] = await Promise.all([
      claimDueWatchChecks(prisma, t0, 10),
      claimDueWatchChecks(prisma, t0, 10),
    ]);
    const claimed = [...a, ...b].filter((c) => c.routineId === id);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ spaceId: ids.space, botId, watch });
    expect(await claimDueWatchChecks(prisma, min(5), 10)).toEqual([]);
    // the lease expires if the worker never records a result
    expect((await claimDueWatchChecks(prisma, min(11), 10)).map((c) => c.routineId)).toContain(id);
  });

  it("does not claim paused or inactive watches", async () => {
    const id = await newWatch();
    await prisma.routineWatchState.update({
      where: { routineId: id },
      data: { pausedReason: "errors" },
    });
    expect((await claimDueWatchChecks(prisma, min(120), 50)).map((c) => c.routineId)).not.toContain(
      id,
    );
    await resumeWatch(prisma, { routineId: id, spaceId: ids.space, now: min(120) });
    await prisma.routine.update({ where: { id }, data: { active: false } });
    expect((await claimDueWatchChecks(prisma, min(120), 50)).map((c) => c.routineId)).not.toContain(
      id,
    );
  });

  it("baseline, unchanged, changed -> wake with a diff", async () => {
    const id = await newWatch();
    const rec = (n: number, text: string) =>
      recordWatchCheck(prisma, { routineId: id, spaceId: ids.space, now: min(n), text });
    expect(await rec(0, "a\nb")).toEqual({ outcome: "baseline" });
    expect(await rec(60, "a\nb")).toEqual({ outcome: "unchanged" });
    expect(await rec(120, "a\nc")).toEqual({ outcome: "wake", diff: "- b\n+ c", created: null });
    const state = await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: id } });
    expect(state).toMatchObject({
      snapshot: "a\nc",
      wakesToday: 1,
      wakesDay: "2026-03-01",
      pendingChange: false,
      lastChangedAt: min(120),
      nextCheckAt: min(180),
      recentChanges: [0, 1],
    });
  });

  it("holds changes after 6 wakes a day and folds them into the next day", async () => {
    const id = await newWatch();
    const rec = (n: number, text: string) =>
      recordWatchCheck(prisma, { routineId: id, spaceId: ids.space, now: min(n), text });
    await rec(0, "v0");
    for (let i = 1; i <= 6; i++) expect((await rec(i, `v${i}`)).outcome).toBe("wake");
    expect((await rec(7, "v7")).outcome).toBe("pending");
    expect((await rec(8, "v7")).outcome).toBe("pending"); // stable page, still not told
    const next = new Date("2026-03-02T00:30:00Z");
    expect(
      await recordWatchCheck(prisma, { routineId: id, spaceId: ids.space, now: next, text: "v7" }),
    ).toEqual({ outcome: "wake", diff: "- v6\n+ v7", created: null });
    expect(
      (await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: id } })).wakesToday,
    ).toBe(1);
  });

  it("does not start a wake while one is in flight", async () => {
    const id = await newWatch();
    const base = { routineId: id, spaceId: ids.space };
    await recordWatchCheck(prisma, { ...base, now: min(0), text: "a" });
    const r = await recordWatchCheck(prisma, {
      ...base,
      now: min(1),
      text: "b",
      wakeInFlight: true,
    });
    expect(r.outcome).toBe("pending");
    expect((await recordWatchCheck(prisma, { ...base, now: min(2), text: "b" })).outcome).toBe(
      "wake",
    );
  });

  it("backs off on errors, pauses at 5, and a good check resets the count", async () => {
    const id = await newWatch();
    const base = { routineId: id, spaceId: ids.space };
    await recordWatchCheck(prisma, { ...base, now: min(0), text: "a" });
    expect(
      await recordWatchCheck(prisma, { ...base, now: min(1), error: { kind: "transient" } }),
    ).toEqual({
      outcome: "error",
      paused: false,
      pausedReason: null,
    });
    let state = await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: id } });
    expect(state.nextCheckAt).toEqual(min(1 + 120));
    await recordWatchCheck(prisma, { ...base, now: min(2), text: "a" });
    state = await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: id } });
    expect(state.consecutiveErrors).toBe(0);
    let last: Awaited<ReturnType<typeof recordWatchCheck>> | undefined;
    for (let i = 0; i < 5; i++) {
      last = await recordWatchCheck(prisma, {
        ...base,
        now: min(10 + i),
        error: { kind: "transient" },
      });
    }
    expect(last).toEqual({ outcome: "error", paused: true, pausedReason: "errors" });
    expect(
      (await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: id } })).nextCheckAt,
    ).toBeNull();
    const access = await newWatch();
    expect(
      await recordWatchCheck(prisma, {
        routineId: access,
        spaceId: ids.space,
        now: min(0),
        error: { kind: "access" },
      }),
    ).toMatchObject({ paused: true, pausedReason: "access" });
  });

  it("pauses a watch that changes on 8 of 10 checks", async () => {
    const id = await newWatch();
    const base = { routineId: id, spaceId: ids.space };
    await recordWatchCheck(prisma, { ...base, now: min(0), text: "x0" });
    let last: Awaited<ReturnType<typeof recordWatchCheck>> | undefined;
    for (let i = 1; i <= 10; i++) {
      last = await recordWatchCheck(prisma, {
        ...base,
        now: new Date(t0.getTime() + i * 86_400_000),
        text: `x${i}`,
      });
    }
    expect(last).toEqual({ outcome: "noisy" });
    expect(
      (await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: id } })).pausedReason,
    ).toBe("noisy");
  });

  it("caps the space at 50 wakes a day and counts watches per bot and space", async () => {
    const before = await countWatches(prisma, { spaceId: ids.space, botId });
    expect(before.bot).toBeGreaterThan(0);
    expect(before.space).toBe(before.bot);
    const other = await newWatch(otherBotId, otherSpace);
    expect(await countWatches(prisma, { spaceId: ids.space, botId })).toEqual(before);
    expect((await countWatches(prisma, { spaceId: otherSpace, botId: otherBotId })).space).toBe(1);
    await prisma.routineWatchState.update({
      where: { routineId: other },
      data: { wakesToday: 50, wakesDay: "2026-03-01" },
    });
    expect(await spaceWatchWakesToday(prisma, { spaceId: otherSpace, now: t0 })).toBe(50);
    expect(await spaceWatchWakesToday(prisma, { spaceId: ids.space, now: t0 })).toBeGreaterThan(0);
    const second = await newWatch(otherBotId, otherSpace);
    const base = { routineId: second, spaceId: otherSpace };
    await recordWatchCheck(prisma, { ...base, now: min(0), text: "a" });
    expect((await recordWatchCheck(prisma, { ...base, now: min(1), text: "b" })).outcome).toBe(
      "pending",
    );
  });

  it("rolls back the snapshot and budget when creating the wake fails", async () => {
    const id = await newWatch();
    const base = { routineId: id, spaceId: ids.space };
    await recordWatchCheck(prisma, { ...base, now: min(0), text: "a" });
    await expect(
      recordWatchCheck(prisma, { ...base, now: min(1), text: "b" }, async () => {
        throw new Error("crash");
      }),
    ).rejects.toThrow("crash");
    const state = await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: id } });
    expect(state).toMatchObject({ snapshot: "a", wakesToday: 0 });
    // the next probe sees the change again and creates the wake
    const retry = await recordWatchCheck(
      prisma,
      { ...base, now: min(2), text: "b" },
      async () => 7,
    );
    expect(retry).toMatchObject({ outcome: "wake", created: 7 });
  });

  it("holds the space cap when two watches wake at once", async () => {
    const space = otherSpace;
    const a = await newWatch(otherBotId, space);
    const b = await newWatch(otherBotId, space);
    const c = await newWatch(otherBotId, space);
    // the space is one wake short of the cap (c holds 49 of its own)
    await prisma.routineWatchState.updateMany({
      where: { spaceId: space },
      data: { wakesToday: 0, wakesDay: null },
    });
    await prisma.routineWatchState.update({
      where: { routineId: c },
      data: { wakesToday: 49, wakesDay: "2026-03-01" },
    });
    for (const id of [a, b]) {
      await recordWatchCheck(prisma, { routineId: id, spaceId: space, now: min(0), text: "x" });
    }
    const slow = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return null;
    };
    const results = await Promise.all(
      [a, b].map((id) =>
        recordWatchCheck(prisma, { routineId: id, spaceId: space, now: min(1), text: "y" }, slow),
      ),
    );
    expect(results.map((r) => r.outcome).sort()).toEqual(["pending", "wake"]);
  });

  it("wakes with a note when the page changes only beyond the kept 16 KB", async () => {
    const id = await newWatch();
    const base = { routineId: id, spaceId: ids.space };
    const head = Array.from({ length: 2000 }, (_, i) => `line ${i} xxxxxxxxxx`).join("\n");
    await recordWatchCheck(prisma, { ...base, now: min(0), text: `${head}\ntail one` });
    expect(
      (await recordWatchCheck(prisma, { ...base, now: min(60), text: `${head}\ntail one` }))
        .outcome,
    ).toBe("unchanged");
    const changed = await recordWatchCheck(prisma, {
      ...base,
      now: min(120),
      text: `${head}\ntail two`,
    });
    expect(changed).toMatchObject({
      outcome: "wake",
      diff: "The page changed below the part I keep (first 16 KB).",
    });
  });

  it("deleting the routine removes its watch state", async () => {
    const id = await newWatch();
    await prisma.routine.delete({ where: { id } });
    expect(await prisma.routineWatchState.findUnique({ where: { routineId: id } })).toBeNull();
  });

  it("keeps one managed check-in routine per bot", async () => {
    const input = {
      spaceId: ids.space,
      userId: ids.user,
      botId,
      timezone: "America/New_York",
      now: t0,
    };
    expect(await upsertCheckInRoutine(prisma, { ...input, cadence: "off" })).toBeNull();
    const daily = await upsertCheckInRoutine(prisma, { ...input, cadence: "daily" });
    expect(daily).toMatchObject({
      managedKind: "check_in",
      quiet: true,
      active: true,
      crons: ["0 9 * * *"],
    });
    expect(daily!.nextRunAt?.toISOString()).toBe("2026-03-01T14:00:00.000Z");
    expect(await getCheckInCadence(prisma, { spaceId: ids.space, botId })).toBe("daily");
    const four = await upsertCheckInRoutine(prisma, { ...input, cadence: "every_4h" });
    expect(four!.id).toBe(daily!.id);
    expect(await getCheckInCadence(prisma, { spaceId: ids.space, botId })).toBe("every_4h");
    const off = await upsertCheckInRoutine(prisma, { ...input, cadence: "off" });
    expect(off).toMatchObject({ id: daily!.id, active: false, nextRunAt: null });
    expect(await getCheckInCadence(prisma, { spaceId: ids.space, botId })).toBe("off");
    expect(await prisma.routine.count({ where: { botId, managedKind: "check_in" } })).toBe(1);
    await expect(
      prisma.routine.create({
        data: {
          spaceId: ids.space,
          botId,
          userId: ids.user,
          name: "dup",
          prompt: "p",
          crons: [],
          managedKind: "check_in",
        },
      }),
    ).rejects.toThrow();
  });
});
