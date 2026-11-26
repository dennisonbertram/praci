import { BOT_PAGE_MAX_CHARS, BOT_PAGE_MAX_CHARTS, MAX_CHART_DATA_ROWS } from "@rakazo/contracts";
import { pageGtmFence } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";

const addSidebarBotPage = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({})));
vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  addSidebarBotPage,
}));

import {
  createBotPage,
  listBotPages,
  pageCardBlock,
  pageToolFromTool,
  removeBotPage,
  renameBotPage,
  renderPageChartSvg,
  saveBotPage,
} from "./pages.js";

type Row = Record<string, unknown>;

/** In-memory stand-in for the page tables; updateMany honors the revision guard like SQL. */
function fakePagePrisma() {
  const pages: Row[] = [];
  const revisions: Row[] = [];
  const match = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);
  const prisma = {
    bot: { findFirst: vi.fn(async () => ({ name: "Finance" })) },
    botPage: {
      findFirst: vi.fn(
        async ({ where }: { where: Row }) => pages.find((p) => match(p, where)) ?? null,
      ),
      findMany: vi.fn(async ({ where }: { where: Row }) => pages.filter((p) => match(p, where))),
      create: vi.fn(async ({ data }: { data: Row }) => {
        // Like the unique (botId, title) index.
        if (pages.some((p) => p.botId === data.botId && p.title === data.title)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = {
          id: `page-${pages.length + 1}`,
          updatedAt: new Date("2026-10-17T00:00:00Z"),
          ...data,
        };
        pages.push(row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: Row }) => {
        const before = pages.length;
        for (let i = pages.length - 1; i >= 0; i--)
          if (match(pages[i] as Row, where)) pages.splice(i, 1);
        return { count: before - pages.length };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = pages.find((p) => match(p, where));
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      }),
    },
    botPageRevision: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        revisions.push(data);
        return data;
      }),
    },
    artifactShare: { updateMany: vi.fn(async () => ({ count: 1 })) },
    thread: { findFirst: vi.fn(async () => ({ id: "thread-1" })) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma: prisma as unknown as PrismaClient, pages, revisions, raw: prisma };
}

const scope = { spaceId: "space-1", botId: "bot-1", userId: "user-1" };
const chart = (
  rows: unknown[] = [{ a: "x", b: 1 }],
  marks: unknown[] = [{ type: "barY", options: { x: "a", y: "b" } }],
) => `\`\`\`chart\n${JSON.stringify({ name: "Sales", spec: { marks }, data: rows })}\n\`\`\``;

function setup() {
  const fake = fakePagePrisma();
  const events = { append: vi.fn(async () => ({}) as never) };
  const save = (
    content: string,
    baseRevision: number,
    updatedBy: "bot" | "user" = "user",
    gtmPage = false,
  ) =>
    saveBotPage(
      { prisma: fake.prisma, events },
      { ...scope, content, baseRevision, updatedBy, gtmPage },
    );
  return { ...fake, events, save };
}

describe("saveBotPage", () => {
  it("creates, revises, writes a revision row and emits page.updated", async () => {
    const { save, revisions, events } = setup();
    const first = await save(`# Hi\n\n${chart()}`, 0);
    expect(first).toMatchObject({ ok: true, page: { revision: 1, updatedBy: "user" } });
    const second = await save("# Hi again", 1, "bot");
    expect(second).toMatchObject({ ok: true, page: { revision: 2, updatedBy: "bot" } });
    expect(revisions.map((r) => r.revision)).toEqual([1, 2]);
    expect(events.append).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "page.updated",
        threadId: "thread-1",
        payload: { pageId: "page-1", revision: 2, updatedBy: "bot" },
      }),
    );
  });

  it("returns the current page and writes nothing on a stale revision", async () => {
    const { save, revisions, events } = setup();
    await save("one", 0);
    const stale = await save("two", 0);
    expect(stale).toMatchObject({
      ok: false,
      reason: "conflict",
      page: { content: "one", revision: 1 },
    });
    const stale2 = await save("three", 5);
    expect(stale2).toMatchObject({ ok: false, reason: "conflict" });
    expect(revisions).toHaveLength(1);
    expect(events.append).toHaveBeenCalledTimes(1);
  });

  it("loses a concurrent save instead of overwriting it", async () => {
    const { save, raw, pages } = setup();
    await save("one", 0);
    // Another writer bumps the revision between our read and our update.
    const real = raw.botPage.updateMany.getMockImplementation();
    raw.botPage.updateMany.mockImplementationOnce(async (args) => {
      Object.assign(pages[0] as Row, { revision: 2, content: "theirs" });
      return real?.(args) ?? { count: 0 };
    });
    expect(await save("mine", 1)).toMatchObject({
      ok: false,
      reason: "conflict",
      page: { content: "theirs" },
    });
  });

  it("rejects an invalid chart with a clear message", async () => {
    const { save, pages } = setup();
    await expect(save("```chart\nnot json\n```", 0)).rejects.toThrow(/not valid JSON/);
    await expect(save("```chart\n{}", 0)).rejects.toThrow(/closing/);
    await expect(save(chart([], [{ type: "noSuchMark", options: {} }]), 0)).rejects.toThrow(
      /Chart "Sales" is invalid/,
    );
    expect(pages).toHaveLength(0);
  });

  it("rejects a chart whose spec-embedded rows pass the row limit", async () => {
    const { save } = setup();
    const rows = Array.from({ length: MAX_CHART_DATA_ROWS + 1 }, (_, i) => ({ x: i }));
    const spec = { marks: [{ type: "dot", data: rows, x: "x" }] };
    const fence = `\`\`\`chart\n${JSON.stringify({ name: "Big", spec, data: [] })}\n\`\`\``;
    await expect(save(fence, 0)).rejects.toThrow(/row limit/);
  });

  it("enforces the size and chart-count limits", async () => {
    const { save } = setup();
    await expect(save("x".repeat(BOT_PAGE_MAX_CHARS + 1), 0)).rejects.toThrow(/limit/);
    await expect(
      save(
        Array(BOT_PAGE_MAX_CHARTS + 1)
          .fill(chart())
          .join("\n\n"),
        0,
      ),
    ).rejects.toThrow(/charts; the limit/);
  });

  it.each([
    ["unknown query keys", '```gtm-plan\n{"group":"done","other":true}\n```'],
    ["needs-you plan group", '```gtm-plan\n{"group":"needs_you"}\n```'],
    [
      "41-character metric label",
      `\`\`\`gtm-metric\n${JSON.stringify({ label: "x".repeat(41), count: "done" })}\n\`\`\``,
    ],
    [
      "the thirteenth GTM block",
      Array.from({ length: 13 }, () => "```gtm-channels\n{}\n```").join("\n"),
    ],
  ])("rejects %s before persisting a GTM page", async (_case, content) => {
    const { save, pages, revisions, raw } = setup();
    await expect(save(content, 0, "user", true)).rejects.toThrow();
    expect(pages).toHaveLength(0);
    expect(revisions).toHaveLength(0);
    expect(raw.botPage.create).not.toHaveBeenCalled();
  });

  it("accepts valid GTM page blocks when scoped as a GTM page", async () => {
    const { save, pages } = setup();
    const result = await save(
      pageGtmFence({ type: "gtm-plan", query: { group: "done" } }),
      0,
      "user",
      true,
    );
    expect(result).toMatchObject({ ok: true, page: { revision: 1 } });
    expect(pages).toHaveLength(1);
  });
});

describe("renderPageChartSvg", () => {
  it("renders a valid chart and degrades to an error SVG for a bad one", async () => {
    const good = await renderPageChartSvg({
      name: "c",
      spec: { marks: [{ type: "barY", options: { x: "a", y: "b" } }] },
      data: [{ a: "x", b: 1 }],
    });
    expect(good).toContain("<svg");
    const bad = await renderPageChartSvg({ name: "c", spec: { marks: [] }, data: [] });
    expect(bad).toContain("could not be rendered");
  });
});

describe("renderPageChartSvg history", () => {
  it("plots a history chart on a time axis without a warning or ISO ticks", async () => {
    const data = Array.from({ length: 8 }, (_, i) => ({
      at: new Date(Date.UTC(2026, 8, 6 + i * 7, 13, 17)).toISOString(),
      value: 34000 + i * 1000,
    }));
    const svg = await renderPageChartSvg({
      name: "c",
      spec: { marks: [{ type: "lineY", options: { x: "at", y: "value" } }] },
      data,
      source: "cash",
      path: "/cash",
      over: "history",
    });
    expect(svg).not.toContain("warning");
    expect(svg).not.toContain("T13:");
  });
});

describe("page tools", () => {
  const run = (
    name: "page_list" | "page_create" | "page_read" | "page_write" | "page_edit",
    args: Record<string, unknown>,
    t: ReturnType<typeof setup>,
    gtmPage = false,
  ) =>
    pageToolFromTool(
      name,
      { prisma: t.prisma, events: t.events },
      { ...scope, runId: "run-1", gtmPage },
      args,
    );

  it("reads an empty page, writes, and edits by unique match", async () => {
    const t = setup();
    expect(await run("page_read", {}, t)).toEqual({ content: "", revision: 0 });
    expect(await run("page_write", { content: "a b a", baseRevision: 0 }, t)).toEqual({
      ok: true,
      revision: 1,
      link: "/app/pages/bot-1/page-1",
    });
    expect(t.revisions[0]).toMatchObject({ updatedBy: "bot", sourceRunId: "run-1" });
    expect(
      await run("page_edit", { old_string: "b", new_string: "c", baseRevision: 1 }, t),
    ).toEqual({
      ok: true,
      revision: 2,
      link: "/app/pages/bot-1/page-1",
    });
    expect(await run("page_read", {}, t)).toEqual({
      content: "a c a",
      revision: 2,
      title: "Finance",
      link: "/app/pages/bot-1/page-1",
    });
  });

  it("tells the model when old_string is absent or not unique", async () => {
    const t = setup();
    await run("page_write", { content: "a b a", baseRevision: 0 }, t);
    expect(
      await run("page_edit", { old_string: "a", new_string: "z", baseRevision: 1 }, t),
    ).toMatchObject({
      error: expect.stringContaining("2 times"),
    });
    expect(
      await run("page_edit", { old_string: "q", new_string: "z", baseRevision: 1 }, t),
    ).toMatchObject({
      error: expect.stringContaining("0 times"),
    });
    expect((await run("page_read", {}, t)).revision).toBe(1);
  });

  it("returns the current page on conflict and validation errors as text", async () => {
    const t = setup();
    await run("page_write", { content: "one", baseRevision: 0 }, t);
    expect(await run("page_write", { content: "two", baseRevision: 0 }, t)).toMatchObject({
      content: "one",
      revision: 1,
    });
    expect(
      await run("page_write", { content: "```chart\nbad\n```", baseRevision: 1 }, t),
    ).toMatchObject({
      error: expect.stringContaining("Invalid chart block"),
    });
  });

  it("forwards GTM scope to page tool validation", async () => {
    const t = setup();
    expect(
      await run(
        "page_write",
        { content: "[not allowed](https://example.test)", baseRevision: 0 },
        t,
        true,
      ),
    ).toMatchObject({ error: expect.any(String) });
    expect(t.pages).toHaveLength(0);
  });

  it("keeps the saved page when the event append fails", async () => {
    const t = setup();
    t.events.append.mockRejectedValueOnce(new Error("events down"));
    expect(await t.save("one", 0)).toMatchObject({ ok: true, page: { revision: 1 } });
    expect(await t.save("two", 1)).toMatchObject({ ok: true, page: { revision: 2 } });
  });

  it("renders ordered categories in domain order and ISO dates in time order", async () => {
    const months = ["Jan", "Feb", "Mar", "Apr"];
    const rows = months.map((month, i) => ({ month, signups: i + 1 }));
    const marks = [{ type: "line", options: { x: "month", y: "signups" } }];
    const ticks = (svg: string) => [...svg.matchAll(/>(Jan|Feb|Mar|Apr)</g)].map((m) => m[1]);
    const ordered = await renderPageChartSvg({
      name: "c",
      spec: { x: { domain: months }, marks },
      data: rows,
    });
    expect(ticks(ordered)).toEqual(months);
    const dated = await renderPageChartSvg({
      name: "c",
      spec: { x: { type: "utc" }, marks: [{ type: "line", options: { x: "d", y: "v" } }] },
      data: [
        { d: "2026-02-01", v: 2 },
        { d: "2026-01-01", v: 1 },
        { d: "2026-03-01", v: 3 },
      ],
    });
    expect(dated).toContain("<svg");
    expect(dated).not.toContain("could not be rendered");
  });
});

describe("named pages", () => {
  it("names the first page after the bot and keeps pages independent", async () => {
    const t = setup();
    await t.save("first", 0);
    expect(t.pages[0]).toMatchObject({ title: "Finance" });
    const second = await createBotPage(
      { prisma: t.prisma, events: t.events },
      { ...scope, title: "Cash" },
    );
    expect(second).toMatchObject({ title: "Cash", revision: 1, content: "" });
    const save = (pageId: string | undefined, base: number, content: string) =>
      saveBotPage(
        { prisma: t.prisma, events: t.events },
        { ...scope, pageId, content, baseRevision: base, updatedBy: "user" },
      );
    expect(await save(second.id, 1, "cash")).toMatchObject({ ok: true, page: { revision: 2 } });
    // The first page still sits at revision 1, and a stale base on one page does not touch the other.
    expect(await save(undefined, 1, "again")).toMatchObject({
      ok: true,
      page: { title: "Finance" },
    });
    expect(await save(second.id, 1, "stale")).toMatchObject({
      ok: false,
      reason: "conflict",
      page: { title: "Cash", content: "cash" },
    });
    expect((await listBotPages(t.prisma, scope)).map((p) => [p.title, p.revision])).toEqual([
      ["Finance", 2],
      ["Cash", 2],
    ]);
  });

  it("rejects a duplicate title, a 21st page, and a save to a removed page", async () => {
    const t = setup();
    const deps = { prisma: t.prisma, events: t.events };
    await createBotPage(deps, { ...scope, title: "Cash" });
    await expect(createBotPage(deps, { ...scope, title: "Cash" })).rejects.toThrow(
      "A page named Cash already exists",
    );
    for (let i = 1; i < 20; i++) await createBotPage(deps, { ...scope, title: `P${i}` });
    await expect(createBotPage(deps, { ...scope, title: "One more" })).rejects.toThrow(
      "This bot already has 20 pages",
    );
    const id = t.pages[0]?.id as string;
    expect(await removeBotPage(t.prisma, { ...scope, pageId: id })).toBe(true);
    expect(
      await saveBotPage(deps, {
        ...scope,
        pageId: id,
        content: "x",
        baseRevision: 0,
        updatedBy: "user",
      }),
    ).toMatchObject({ ok: false, page: null });
  });

  it("revokes the page's share links when it is removed, and only then", async () => {
    const t = setup();
    await createBotPage({ prisma: t.prisma, events: t.events }, { ...scope, title: "Cash" });
    const id = t.pages[0]?.id as string;
    expect(await removeBotPage(t.prisma, { ...scope, pageId: "missing" })).toBe(false);
    expect(t.raw.artifactShare.updateMany).not.toHaveBeenCalled();
    expect(await removeBotPage(t.prisma, { ...scope, pageId: id })).toBe(true);
    expect(t.raw.artifactShare.updateMany).toHaveBeenCalledWith({
      where: {
        spaceId: scope.spaceId,
        revokedAt: null,
        artifact: { spaceId: scope.spaceId, botId: scope.botId, runId: `page-share:${id}` },
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("lists pages without loading their content", async () => {
    const t = setup();
    await listBotPages(t.prisma, scope);
    expect(t.raw.botPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, title: true, kind: true, revision: true, updatedAt: true },
      }),
    );
  });

  it("renames a page and refuses a title another page uses", async () => {
    const t = setup();
    const deps = { prisma: t.prisma, events: t.events };
    const a = await createBotPage(deps, { ...scope, title: "A" });
    await createBotPage(deps, { ...scope, title: "B" });
    await expect(renameBotPage(t.prisma, { ...scope, pageId: a.id, title: "b" })).rejects.toThrow(
      "A page named b already exists",
    );
    expect(await renameBotPage(t.prisma, { ...scope, pageId: a.id, title: " Z " })).toMatchObject({
      title: "Z",
    });
    expect(await renameBotPage(t.prisma, { ...scope, pageId: "nope", title: "C" })).toBeNull();
  });

  it("tools address a page by title, case-insensitively, and error on an unknown title", async () => {
    const t = setup();
    const run = (name: Parameters<typeof pageToolFromTool>[0], args: Record<string, unknown>) =>
      pageToolFromTool(
        name,
        { prisma: t.prisma, events: t.events },
        { ...scope, runId: "run-1" },
        args,
      );
    const link = expect.stringMatching(/^\/app\/pages\/bot-1\/[^/]+$/);
    expect(await run("page_create", { title: "Cash" })).toEqual({
      ok: true,
      pageId: expect.any(String),
      link,
      title: "Cash",
      kind: "blocks",
      revision: 1,
    });
    expect(await run("page_create", { title: "cash" })).toMatchObject({
      error: expect.any(String),
    });
    expect(await run("page_write", { page: "CASH", content: "c", baseRevision: 1 })).toEqual({
      ok: true,
      revision: 2,
      link,
    });
    expect(await run("page_read", { page: "cash" })).toMatchObject({
      content: "c",
      title: "Cash",
      link,
    });
    expect(await run("page_read", { page: "Nope" })).toMatchObject({
      error: expect.stringContaining("page_list"),
    });
    expect(await run("page_write", { page: "Nope", content: "x", baseRevision: 0 })).toMatchObject({
      error: expect.stringContaining("page_create"),
    });
    expect(await run("page_list", {})).toMatchObject({
      pages: [{ title: "Cash", revision: 2, link }],
    });
  });

  it("a created page gets one chat card with ids and title; writes, edits and failed creates get none", async () => {
    const t = setup();
    const run = (name: Parameters<typeof pageToolFromTool>[0], args: Record<string, unknown>) =>
      pageToolFromTool(
        name,
        { prisma: t.prisma, events: t.events },
        { ...scope, runId: "run-1" },
        args,
      );
    const created = await run("page_create", { title: "Cash" });
    expect(pageCardBlock("page_create", scope, created)).toEqual({
      kind: "page",
      botId: scope.botId,
      pageId: created.pageId,
      title: "Cash",
    });
    const written = await run("page_write", { page: "Cash", content: "c", baseRevision: 1 });
    expect(pageCardBlock("page_write", scope, written)).toBeNull();
    const edited = await run("page_edit", {
      page: "Cash",
      old_string: "c",
      new_string: "d",
      baseRevision: 2,
    });
    expect(pageCardBlock("page_edit", scope, edited)).toBeNull();
    const duplicate = await run("page_create", { title: "cash" });
    expect(pageCardBlock("page_create", scope, duplicate)).toBeNull();
  });

  describe("sidebar for agent-created pages", () => {
    const run = (
      t: ReturnType<typeof setup>,
      name: Parameters<typeof pageToolFromTool>[0],
      args: Record<string, unknown>,
    ) =>
      pageToolFromTool(
        name,
        { prisma: t.prisma, events: t.events },
        { ...scope, runId: "run-1" },
        args,
      );

    it("adds a created page to its owner's sidebar once; a duplicate, write and edit add nothing", async () => {
      addSidebarBotPage.mockClear();
      const t = setup();
      const created = await run(t, "page_create", { title: "Cash" });
      expect(addSidebarBotPage).toHaveBeenCalledExactlyOnceWith(
        t.prisma,
        { spaceId: "space-1", userId: "user-1" },
        created.pageId,
      );
      await run(t, "page_create", { title: "cash" });
      await run(t, "page_write", { page: "Cash", content: "c", baseRevision: 1 });
      await run(t, "page_edit", {
        page: "Cash",
        old_string: "c",
        new_string: "d",
        baseRevision: 2,
      });
      expect(addSidebarBotPage).toHaveBeenCalledTimes(1);
    });

    it("still creates the page when the sidebar cannot be updated", async () => {
      addSidebarBotPage.mockRejectedValueOnce(new Error("db down"));
      const t = setup();
      expect(await run(t, "page_create", { title: "Cash" })).toMatchObject({ ok: true });
      expect(t.pages).toHaveLength(1);
    });
  });
});
