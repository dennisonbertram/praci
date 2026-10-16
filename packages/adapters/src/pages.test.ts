import { BOT_PAGE_MAX_CHARS, BOT_PAGE_MAX_CHARTS } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { pageToolFromTool, renderPageChartSvg, saveBotPage } from "./pages.js";

type Row = Record<string, unknown>;

/** In-memory stand-in for the page tables; updateMany honors the revision guard like SQL. */
function fakePagePrisma() {
  const pages: Row[] = [];
  const revisions: Row[] = [];
  const match = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);
  const prisma = {
    botPage: {
      findFirst: vi.fn(
        async ({ where }: { where: Row }) => pages.find((p) => match(p, where)) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = {
          id: `page-${pages.length + 1}`,
          updatedAt: new Date("2026-10-17T00:00:00Z"),
          ...data,
        };
        pages.push(row);
        return row;
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
  const save = (content: string, baseRevision: number, updatedBy: "bot" | "user" = "user") =>
    saveBotPage({ prisma: fake.prisma, events }, { ...scope, content, baseRevision, updatedBy });
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
        payload: { revision: 2, updatedBy: "bot" },
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

describe("page tools", () => {
  const run = (
    name: "page_read" | "page_write" | "page_edit",
    args: Record<string, unknown>,
    t: ReturnType<typeof setup>,
  ) =>
    pageToolFromTool(
      name,
      { prisma: t.prisma, events: t.events },
      { ...scope, runId: "run-1" },
      args,
    );

  it("reads an empty page, writes, and edits by unique match", async () => {
    const t = setup();
    expect(await run("page_read", {}, t)).toEqual({ content: "", revision: 0 });
    expect(await run("page_write", { content: "a b a", baseRevision: 0 }, t)).toEqual({
      ok: true,
      revision: 1,
    });
    expect(t.revisions[0]).toMatchObject({ updatedBy: "bot", sourceRunId: "run-1" });
    expect(
      await run("page_edit", { old_string: "b", new_string: "c", baseRevision: 1 }, t),
    ).toEqual({
      ok: true,
      revision: 2,
    });
    expect(await run("page_read", {}, t)).toEqual({ content: "a c a", revision: 2 });
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
