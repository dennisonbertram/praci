import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  pageChartSvgs,
  pageSourceToolFromTool,
  refreshPageSource,
  refreshPageSources,
  resolveBlocksPageData,
  runPraciSourceTool,
  updatePageSourceByOwner,
} from "./page-sources.js";
import { createBotPage, saveBotPage } from "./pages.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("page sources (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `psrc-org-${suffix}`;
  const spaceId = `psrc-space-${suffix}`;
  const userId = `psrc-user-${suffix}`;
  const otherUserId = `psrc-other-${suffix}`;
  const append = vi.fn(async () => ({}) as never);
  const events = { append };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let financeBotId: string;
  let pageId: string;

  const deps = () => ({ prisma, events });
  const scope = () => ({ spaceId, botId, userId, runId: "run-1" });
  const set = (args: Record<string, unknown>) =>
    pageSourceToolFromTool("page_source_set", deps(), scope(), args);
  const bot = (id: string) =>
    prisma.bot.findFirstOrThrow({
      where: { id },
      select: {
        id: true,
        spaceId: true,
        userId: true,
        spawnKey: true,
        audience: true,
        archivedAt: true,
        disabledBuiltinTools: true,
      },
    });
  const sourceRow = (name: string) =>
    prisma.pageSource.findFirstOrThrow({ where: { pageId, name } });
  const snapshot = (sourceId: string, value: unknown, fetchedAt: Date) =>
    prisma.pageSourceSnapshot.create({
      data: { spaceId, sourceId, value: value as object, bytes: 1, fetchedAt },
    });
  const page = async () => {
    const row = await prisma.botPage.findFirstOrThrow({ where: { id: pageId } });
    return { id: row.id, botId: row.botId, content: row.content, revision: row.revision };
  };
  const writePage = async (content: string) => {
    const current = await prisma.botPage.findFirstOrThrow({ where: { id: pageId } });
    const result = await saveBotPage(deps(), {
      spaceId,
      botId,
      userId,
      pageId,
      content,
      baseRevision: current.revision,
      updatedBy: "bot",
    });
    expect(result.ok).toBe(true);
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [userId, otherUserId]) {
      await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
    }
    await prisma.organization.create({
      data: { id: organizationId, name: "PS Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "Chief", color: "blue" } }))
      .id;
    financeBotId = (
      await prisma.bot.create({
        data: {
          spaceId,
          userId,
          name: "Finance",
          color: "green",
          spawnKey: `finance-agent:${userId}`,
        },
      })
    ).id;
    await prisma.thread.create({ data: { spaceId, userId, botId } });
    pageId = (await createBotPage(deps(), { spaceId, botId, userId, title: "Cash" })).id;
    await prisma.contact.createMany({
      data: [
        { spaceId, userId, name: "Ada Mine", kind: "investor" },
        { spaceId, userId, name: "Bo Mine", kind: "investor" },
        { spaceId, userId: otherUserId, name: "Cy Theirs", kind: "investor" },
      ],
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("saves a source, runs it once and returns a preview with the owner's data only", async () => {
    // The model cannot widen scope through args.
    const result = (await set({
      name: "People",
      tool: "contacts_list",
      args: { userId: otherUserId, spaceId: "someone-else" },
    })) as { source: { status: string; schedule: string; lastRefreshAt: string }; preview: string };
    expect(result.source).toMatchObject({ status: "active", schedule: "1h" });
    expect(result.source.lastRefreshAt).toBeTruthy();
    expect(result.preview).toContain("Ada Mine");
    expect(result.preview).not.toContain("Cy Theirs");
    const row = await sourceRow("People");
    expect(row.nextRefreshAt).not.toBeNull();
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } })).toBe(1);
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ type: "page.data" }));
  });

  it("refuses tools that are not allowlisted or that this bot would not have in a run", async () => {
    expect(await set({ name: "Mail", tool: "mail_search" })).toMatchObject({
      error: expect.stringContaining("cannot be a page source"),
    });
    expect(await set({ name: "Cash", tool: "finance_overview" })).toMatchObject({
      error: expect.stringContaining("does not have finance_overview"),
    });
    expect(
      await prisma.pageSource.count({ where: { pageId, name: { in: ["Mail", "Cash"] } } }),
    ).toBe(0);
    await expect(
      runPraciSourceTool(
        deps(),
        { spaceId, userId, bot: await bot(botId) },
        "fundraising_read",
        {},
      ),
    ).rejects.toThrow("does not have");
    // A bot of another owner cannot be run under this owner's scope.
    await expect(
      runPraciSourceTool(
        deps(),
        { spaceId, userId: otherUserId, bot: await bot(botId) },
        "contacts_list",
        {},
      ),
    ).rejects.toThrow("does not belong");
    // The Finance agent passes the finance gate, then reports that no finance source is connected.
    await expect(
      runPraciSourceTool(
        deps(),
        { spaceId, userId, bot: await bot(financeBotId) },
        "finance_overview",
        {},
      ),
    ).rejects.toThrow("No finance source");
  });

  it("replaces a source by name, drops old snapshots when the call changes, and caps sources", async () => {
    const before = await sourceRow("People");
    await set({ name: "people", tool: "contacts_list", args: { query: "Bo" }, schedule: "1d" });
    const after = await prisma.pageSource.findMany({
      where: { pageId, name: { in: ["People", "people"] } },
    });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: before.id, schedule: "1d", name: "people" });
    // One snapshot from the new call's immediate run; the first call's snapshot is gone.
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: before.id } })).toBe(1);
    for (let i = 0; i < 19; i++) {
      expect(await set({ name: `s${i}`, tool: "contacts_list" })).toHaveProperty("source");
    }
    expect(await set({ name: "one too many", tool: "contacts_list" })).toMatchObject({
      error: expect.stringContaining("20 sources"),
    });
    const listed = (await pageSourceToolFromTool("page_source_list", deps(), scope(), {})) as {
      sources: unknown[];
    };
    expect(listed.sources).toHaveLength(20);
    for (let i = 0; i < 19; i++) {
      await pageSourceToolFromTool("page_source_remove", deps(), scope(), { name: `S${i}` });
    }
    expect(await prisma.pageSource.count({ where: { pageId } })).toBe(1);
  });

  it("keeps the last snapshot and records a short error when a refresh fails", async () => {
    const row = await sourceRow("people");
    const good = await prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } });
    // The bot loses the tool: the next run is refused.
    await prisma.bot.update({
      where: { id: botId },
      data: { disabledBuiltinTools: ["contacts_list"] },
    });
    const failed = await refreshPageSource(deps(), row);
    await prisma.bot.update({ where: { id: botId }, data: { disabledBuiltinTools: [] } });
    expect(failed).toEqual({ ok: false, error: "contacts_list is switched off for this bot." });
    const after = await sourceRow("people");
    expect(after).toMatchObject({
      lastError: "contacts_list is switched off for this bot.",
      failures: 1,
    });
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } })).toBe(good);
    const ok = await refreshPageSource(deps(), after);
    expect(ok.ok).toBe(true);
    expect(await sourceRow("people")).toMatchObject({ lastError: null, failures: 0 });
  });

  it("fails a refresh whose result is over 1 MB or takes over the timeout", async () => {
    const row = await sourceRow("people");
    await prisma.contact.create({
      data: { spaceId, userId, name: "Bo Big", kind: "customer", notes: "x".repeat(1_100_000) },
    });
    const big = await refreshPageSource(deps(), row);
    expect(big).toEqual({
      ok: false,
      error: "The result is larger than 1 MB. Narrow the tool's arguments.",
    });
    await prisma.contact.deleteMany({ where: { name: "Bo Big", spaceId } });
    // A tool that never answers.
    const hung = new Proxy(prisma, {
      get: (target, key) =>
        key === "contact" ? { findMany: () => new Promise(() => {}) } : Reflect.get(target, key),
    });
    const slow = await refreshPageSource({ ...deps(), prisma: hung, timeoutMs: 50 }, row);
    expect(slow.ok).toBe(false);
    expect((await sourceRow("people")).lastError).toContain("took longer than");
  });

  it("only runs active sources and skips ones refreshed in the last minute", async () => {
    const row = await sourceRow("people");
    await prisma.pageSource.update({ where: { id: row.id }, data: { lastRefreshAt: new Date() } });
    const count = () => prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } });
    const before = await count();
    await refreshPageSources(deps(), { spaceId, botId, pageId });
    expect(await count()).toBe(before);
    await prisma.pageSource.update({
      where: { id: row.id },
      data: { lastRefreshAt: new Date(Date.now() - 61_000) },
    });
    await refreshPageSources(deps(), { spaceId, botId, pageId });
    expect(await count()).toBe(before + 1);
    await prisma.pageSource.update({ where: { id: row.id }, data: { status: "paused" } });
    expect(await refreshPageSource(deps(), { ...row, status: "paused" })).toMatchObject({
      ok: false,
    });
    await prisma.pageSource.update({ where: { id: row.id }, data: { status: "active" } });
  });

  it("does not manually refresh a source while its scheduler lease is held", async () => {
    const row = await prisma.pageSource.create({
      data: {
        spaceId,
        userId,
        botId,
        pageId,
        name: "leased",
        kind: "praci",
        call: { tool: "contacts_list", args: {} },
        schedule: "1h",
        status: "active",
        lastRefreshAt: new Date(Date.now() - 61_000),
        leaseUntil: new Date(Date.now() + 60_000),
      },
    });
    await prisma.pageSource.updateMany({
      where: { pageId, id: { not: row.id }, status: "active" },
      data: { lastRefreshAt: new Date() },
    });
    const before = await prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } });
    const tool = vi.fn();
    const isolated = new Proxy(prisma, {
      get: (target, key) => (key === "contact" ? { findMany: tool } : Reflect.get(target, key)),
    });

    await refreshPageSources({ ...deps(), prisma: isolated }, { spaceId, botId, pageId });

    expect(tool).not.toHaveBeenCalled();
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } })).toBe(before);
  });

  it("skips a source the scheduler refreshed while an earlier source was running", async () => {
    await prisma.pageSource.updateMany({
      where: { pageId, status: "active" },
      data: { lastRefreshAt: new Date() },
    });
    const make = (name: string) =>
      prisma.pageSource.create({
        data: {
          spaceId,
          userId,
          botId,
          pageId,
          name,
          kind: "praci",
          call: { tool: "contacts_list", args: {} },
          schedule: "1h",
          status: "active",
          lastRefreshAt: new Date(Date.now() - 61_000),
        },
      });
    await make("slow first");
    const second = await make("finished by scheduler");
    let release: (value: unknown[]) => void = () => undefined;
    const tool = vi
      .fn()
      .mockImplementationOnce(() => new Promise<unknown[]>((resolve) => (release = resolve)))
      .mockResolvedValue([]);
    const isolated = new Proxy(prisma, {
      get: (target, key) => (key === "contact" ? { findMany: tool } : Reflect.get(target, key)),
    });

    const running = refreshPageSources({ ...deps(), prisma: isolated }, { spaceId, botId, pageId });
    await vi.waitFor(() => expect(tool).toHaveBeenCalledTimes(1));
    // The scheduler finishes the second source while the first is still running.
    await prisma.pageSource.updateMany({
      where: { id: second.id, spaceId },
      data: { lastRefreshAt: new Date(), leaseUntil: null },
    });
    release([]);
    await running;

    expect(tool).toHaveBeenCalledTimes(1);
  });

  it("uses the current schedule when it changes during a successful refresh", async () => {
    const row = await prisma.pageSource.create({
      data: {
        spaceId,
        userId,
        botId,
        pageId,
        name: "schedule change",
        kind: "praci",
        call: { tool: "contacts_list", args: {} },
        schedule: "1w",
        status: "active",
      },
    });
    const now = new Date();
    let finish!: (value: unknown) => void;
    let started!: () => void;
    const hasStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const deferred = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const isolated = new Proxy(prisma, {
      get: (target, key) =>
        key === "contact"
          ? {
              findMany: () => {
                started();
                return deferred;
              },
            }
          : Reflect.get(target, key),
    });

    const refreshing = refreshPageSource(
      { ...deps(), prisma: isolated, now: () => now, random: () => 0 },
      row,
    );
    await hasStarted;
    await updatePageSourceByOwner(deps(), { spaceId, botId }, row.id, { schedule: "15m" });
    finish([]);
    expect(await refreshing).toMatchObject({ ok: true });
    const saved = await prisma.pageSource.findFirstOrThrow({ where: { id: row.id } });
    expect(saved.nextRefreshAt!.getTime()).toBeLessThanOrEqual(now.getTime() + 15 * 60_000 * 1.05);
  });

  it("does not save a snapshot when a source is paused during a successful refresh", async () => {
    const row = await prisma.pageSource.create({
      data: {
        spaceId,
        userId,
        botId,
        pageId,
        name: "paused success",
        kind: "praci",
        call: { tool: "contacts_list", args: {} },
        schedule: "1h",
        status: "active",
        lastError: "previous failure",
        leaseUntil: new Date(Date.now() + 60_000),
      },
    });
    const before = await prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } });
    const isolated = new Proxy(prisma, {
      get: (target, key) => {
        if (key !== "contact") return Reflect.get(target, key, target);
        const delegate = Reflect.get(target, key, target);
        return new Proxy(delegate, {
          get: (contact, method) => {
            if (method !== "findMany") return Reflect.get(contact, method, contact);
            return async (...args: Parameters<typeof prisma.contact.findMany>) => {
              await prisma.pageSource.update({ where: { id: row.id }, data: { status: "paused" } });
              return Reflect.get(contact, method, contact)(...args);
            };
          },
        });
      },
    });

    expect(await refreshPageSource({ ...deps(), prisma: isolated }, row)).toEqual({
      ok: false,
      error: "The source is paused.",
    });
    expect(await prisma.pageSourceSnapshot.count({ where: { sourceId: row.id } })).toBe(before);
    expect(await prisma.pageSource.findFirstOrThrow({ where: { id: row.id } })).toMatchObject({
      lastError: "previous failure",
      leaseUntil: null,
      status: "paused",
    });
  });

  it("clears the lease when a source is paused during a failed refresh", async () => {
    const row = await prisma.pageSource.create({
      data: {
        spaceId,
        userId,
        botId,
        pageId,
        name: "paused failure",
        kind: "praci",
        call: { tool: "contacts_list", args: {} },
        schedule: "1h",
        status: "active",
        leaseUntil: new Date(Date.now() + 60_000),
      },
    });
    let fail!: (error: Error) => void;
    let started!: () => void;
    const hasStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const deferred = new Promise<unknown>((_resolve, reject) => {
      fail = reject;
    });
    const isolated = new Proxy(prisma, {
      get: (target, key) =>
        key === "contact"
          ? {
              findMany: () => {
                started();
                return deferred;
              },
            }
          : Reflect.get(target, key),
    });

    const refreshing = refreshPageSource({ ...deps(), prisma: isolated }, row);
    await hasStarted;
    await updatePageSourceByOwner(deps(), { spaceId, botId }, row.id, { action: "pause" });
    fail(new Error("offline failure"));
    expect(await refreshing).toMatchObject({ ok: false });
    expect(
      (await prisma.pageSource.findFirstOrThrow({ where: { id: row.id } })).leaseUntil,
    ).toBeNull();
  });

  describe("resolving live blocks", () => {
    const fence = (kind: string, body: object) => `\`\`\`${kind}\n${JSON.stringify(body)}\n\`\`\``;
    const make = async (
      name: string,
      data: Partial<{ status: string; lastError: string | null }> = {},
    ) =>
      prisma.pageSource.create({
        data: {
          spaceId,
          userId,
          botId,
          pageId,
          name,
          kind: "praci",
          call: { tool: "contacts_list", args: {} },
          schedule: "1h",
          status: "active",
          ...data,
        },
      });

    it("reports missing, empty, ok, failed with the last value, and paused", async () => {
      await prisma.pageSource.deleteMany({ where: { pageId } });
      const fresh = await make("fresh");
      await make("never");
      const bad = await make("bad", { lastError: "It broke." });
      const held = await make("held", { status: "paused" });
      const t0 = new Date("2026-10-01T00:00:00Z");
      for (const row of [fresh, bad, held]) {
        await snapshot(row.id, { balance: 1234.5, rows: [{ a: 1, b: 2 }] }, t0);
      }
      await writePage(
        [
          fence("metric", { label: "Fresh", source: "FRESH", path: "/balance", format: "usd" }),
          fence("metric", { label: "Ghost", source: "ghost", path: "/balance" }),
          fence("metric", { label: "Never", source: "never", path: "/balance" }),
          fence("metric", { label: "Bad", source: "bad", path: "/balance", format: "number" }),
          fence("metric", { label: "Held", source: "held", path: "/balance" }),
          fence("metric", { label: "Off", source: "fresh", path: "/nothing" }),
        ].join("\n"),
      );
      const data = await resolveBlocksPageData({ prisma }, { spaceId }, await page());
      expect(data.pageId).toBe(pageId);
      expect(data.blocks).toEqual([
        { status: "ok", fetchedAt: t0.toISOString(), text: "$1,235" },
        { status: "missing", fetchedAt: null },
        { status: "empty", fetchedAt: null },
        { status: "failed", fetchedAt: t0.toISOString(), error: "It broke.", text: "1,234.5" },
        { status: "paused", fetchedAt: t0.toISOString(), text: "1,234.5" },
        { status: "empty", fetchedAt: t0.toISOString() },
      ]);
    });

    it("projects table columns, applies the limit, and treats a wrong shape as empty", async () => {
      const row = await sourceRow("fresh");
      await prisma.pageSourceSnapshot.deleteMany({ where: { sourceId: row.id } });
      await snapshot(
        row.id,
        {
          rows: [
            { a: 1, b: 2 },
            { a: 3, b: 4 },
            { a: 5, b: 6 },
          ],
          n: 7,
        },
        new Date("2026-10-01T00:00:00Z"),
      );
      await writePage(
        [
          fence("table", {
            name: "T",
            source: "fresh",
            path: "/rows",
            columns: [{ key: "b", label: "B" }],
            limit: 2,
          }),
          fence("table", { name: "All", source: "fresh", path: "/rows" }),
          fence("table", { name: "Bad", source: "fresh", path: "/n" }),
        ].join("\n"),
      );
      const data = await resolveBlocksPageData({ prisma }, { spaceId }, await page());
      expect(data.blocks.map((block) => block.status)).toEqual(["ok", "ok", "empty"]);
      expect(data.blocks[0]?.rows).toEqual([{ b: 2 }, { b: 4 }]);
      expect(data.blocks[1]?.rows).toEqual([
        { a: 1, b: 2 },
        { a: 3, b: 4 },
        { a: 5, b: 6 },
      ]);
    });

    it("gives latest rows and a numeric history for charts, and renders them in the server SVG", async () => {
      const row = await sourceRow("fresh");
      await prisma.pageSourceSnapshot.deleteMany({ where: { sourceId: row.id } });
      const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
      const values: unknown[] = [10, "20", "n/a", 40];
      for (const [i, day] of days.entries()) {
        await snapshot(
          row.id,
          { cash: values[i], rows: [{ k: day, v: i }] },
          new Date(`${day}T00:00:00Z`),
        );
      }
      const spec = { marks: [{ type: "lineY", options: { x: "at", y: "value" } }] };
      await writePage(
        [
          fence("chart", {
            name: "Latest",
            spec: { marks: [{ type: "barY", options: { x: "k", y: "v" } }] },
            data: [{ k: "old", v: 0 }],
            source: "fresh",
            path: "/rows",
          }),
          fence("chart", {
            name: "History",
            spec,
            data: [{ at: "2026-09-01", value: 1 }],
            source: "fresh",
            path: "/cash",
            over: "history",
          }),
          fence("chart", { name: "Static", spec, data: [{ at: "2026-09-01", value: 1 }] }),
        ].join("\n"),
      );
      const current = await page();
      const data = await resolveBlocksPageData({ prisma }, { spaceId }, current);
      expect(data.blocks).toHaveLength(2);
      expect(data.blocks[0]?.rows).toEqual([{ k: "2026-10-04", v: 3 }]);
      expect(data.blocks[1]?.rows).toEqual([
        { at: "2026-10-01T00:00:00.000Z", value: 10 },
        { at: "2026-10-02T00:00:00.000Z", value: 20 },
        { at: "2026-10-04T00:00:00.000Z", value: 40 },
      ]);
      const svgs = await pageChartSvgs({ prisma }, { spaceId }, current);
      expect(svgs).toHaveLength(3);
      expect(svgs[0]).toContain("2026-10-04");
      expect(svgs[0]).not.toContain("old");
    });

    it("saves at most 20 live blocks and rejects unknown spec options", async () => {
      const block = fence("metric", { label: "M", source: "fresh" });
      const current = await prisma.botPage.findFirstOrThrow({ where: { id: pageId } });
      const save = (content: string) =>
        saveBotPage(deps(), {
          spaceId,
          botId,
          userId,
          pageId,
          content,
          baseRevision: current.revision,
          updatedBy: "bot",
        });
      await expect(save(Array(21).fill(block).join("\n"))).rejects.toThrow("live blocks");
      await expect(
        save(
          fence("chart", {
            name: "X",
            spec: { figure: true, marks: [{ type: "dot", options: { x: "a", y: "b" } }] },
            data: [{ a: 1, b: 2 }],
          }),
        ),
      ).rejects.toThrow('unknown spec option "figure"');
    });
  });
});
