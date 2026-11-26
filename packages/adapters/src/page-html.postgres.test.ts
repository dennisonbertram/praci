import { PAGE_HTML_DATA_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resolvePageData } from "./page-sources.js";
import {
  createBotPage,
  getBotPage,
  listBotPages,
  PageValidationError,
  pageToolFromTool,
  saveBotPage,
} from "./pages.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const head = (sources: string, history = "") =>
  `<!doctype html><head><meta name="praci-sources" content="${sources}">${
    history ? `<meta name="praci-history" content="${history}">` : ""
  }</head><body>hi</body>`;

describePostgres("HTML pages (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `ph-org-${suffix}`;
  const spaceId = `ph-space-${suffix}`;
  const userId = `ph-user-${suffix}`;
  const events = { append: vi.fn(async () => ({}) as never) };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let otherBotId: string;
  let htmlId: string;
  let blocksId: string;
  const deps = () => ({ prisma, events });
  const source = (pageId: string, name: string, status = "active", lastError?: string) =>
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
        status,
        lastError,
      },
    });
  const snap = (sourceId: string, value: unknown, minutesAgo: number, bytes = 10) =>
    prisma.pageSourceSnapshot.create({
      data: {
        spaceId,
        sourceId,
        value: value as object,
        bytes,
        fetchedAt: new Date(Date.now() - minutesAgo * 60_000),
      },
    });
  const htmlPage = async () => {
    const row = await prisma.botPage.findFirstOrThrow({ where: { id: htmlId } });
    return { ...row };
  };
  const writeHtml = async (content: string) => {
    const current = await prisma.botPage.findFirstOrThrow({ where: { id: htmlId } });
    return saveBotPage(deps(), {
      spaceId,
      botId,
      userId,
      pageId: htmlId,
      content,
      baseRevision: current.revision,
      updatedBy: "bot",
    });
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({ data: { id: userId, name: userId, email: `${userId}@example.test` } });
    await prisma.organization.create({
      data: { id: organizationId, name: "PH Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "Chief", color: "blue" } })).id;
    otherBotId = (
      await prisma.bot.create({ data: { spaceId, userId, name: "Other", color: "red" } })
    ).id;
    blocksId = (await createBotPage(deps(), { spaceId, botId, userId, title: "Notes" })).id;
    htmlId = (await createBotPage(deps(), { spaceId, botId, userId, title: "Dash", kind: "html" }))
      .id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("defaults to blocks, creates html, and lists the kind", async () => {
    const pages = await listBotPages(prisma, { spaceId, botId });
    expect(pages.map((p) => [p.title, p.kind])).toEqual([
      ["Notes", "blocks"],
      ["Dash", "html"],
    ]);
    expect((await getBotPage(prisma, { spaceId, botId, pageId: htmlId }))?.kind).toBe("html");
    const viaTool = await pageToolFromTool(
      "page_create",
      deps(),
      { spaceId, botId, userId, runId: "r" },
      { title: "Tool html", kind: "html" },
    );
    expect(viaTool).toMatchObject({ ok: true, kind: "html" });
    const viaToolDefault = await pageToolFromTool(
      "page_create",
      deps(),
      { spaceId, botId, userId, runId: "r" },
      { title: "Tool default" },
    );
    expect(viaToolDefault).toMatchObject({ ok: true, kind: "blocks" });
  });

  it("saves an html page without Markdown rules, revision-checked, and rejects bad declarations", async () => {
    // A ```chart fence that would be invalid in a blocks page is just text here.
    const ok = await writeHtml(`${head("A")}<pre>\`\`\`chart\nnot json\n\`\`\`</pre>`);
    expect(ok.ok).toBe(true);
    await expect(writeHtml(head("A", "B"))).rejects.toBeInstanceOf(PageValidationError);
    await expect(writeHtml("x".repeat(200_001))).rejects.toThrow(/limit/);
    const stale = await saveBotPage(deps(), {
      spaceId,
      botId,
      userId,
      pageId: htmlId,
      content: head("A"),
      baseRevision: 1,
      updatedBy: "user",
    });
    expect(stale).toMatchObject({ ok: false, reason: "conflict" });
    // A blocks page still rejects a broken chart fence.
    await expect(
      saveBotPage(deps(), {
        spaceId,
        botId,
        userId,
        pageId: blocksId,
        content: "```chart\nnot json\n```",
        baseRevision: 1,
        updatedBy: "bot",
      }),
    ).rejects.toBeInstanceOf(PageValidationError);
  });

  it("does not find another bot's page", async () => {
    expect(await getBotPage(prisma, { spaceId, botId: otherBotId, pageId: htmlId })).toBeNull();
    const result = await saveBotPage(deps(), {
      spaceId,
      botId: otherBotId,
      userId,
      pageId: htmlId,
      content: head("A"),
      baseRevision: 3,
      updatedBy: "bot",
    });
    expect(result.ok).toBe(false);
    expect(await prisma.botPage.count({ where: { id: htmlId, botId } })).toBe(1);
  });

  it("returns only declared sources that exist on this page", async () => {
    const cash = await source(htmlId, "Cash");
    const secret = await source(htmlId, "Secret");
    const elsewhere = await source(blocksId, "Elsewhere");
    await snap(cash.id, { balance: 1 }, 10);
    await snap(cash.id, { balance: 2 }, 1);
    await snap(secret.id, { hidden: true }, 1);
    await snap(elsewhere.id, { other: true }, 1);
    await source(htmlId, "Broken", "active", "It broke.");
    await source(htmlId, "Held", "pending");
    await writeHtml(head("cash, Ghost, Elsewhere, Broken, Held"));
    const data = await resolvePageData({ prisma }, { spaceId }, await htmlPage());
    expect(data).toMatchObject({ kind: "html", pageId: htmlId });
    if (!("sources" in data)) throw new Error("expected an html page");
    expect(Object.keys(data.sources).sort()).toEqual(["Broken", "Elsewhere", "Ghost", "Held", "cash"]);
    expect(data.sources.cash).toMatchObject({ status: "ok", value: { balance: 2 } });
    expect(data.sources.cash?.history).toBeUndefined();
    expect(data.sources.Ghost).toEqual({ status: "missing", fetchedAt: null });
    expect(data.sources.Elsewhere).toEqual({ status: "missing", fetchedAt: null });
    expect(data.sources.Broken).toEqual({ status: "failed", fetchedAt: null, error: "It broke." });
    expect(data.sources.Held).toEqual({ status: "pending", fetchedAt: null });
    expect(JSON.stringify(data)).not.toContain("hidden");
    expect(JSON.stringify(data)).not.toContain("other");
  });

  it("adds history newest first only where declared, and drops the oldest over the cap", async () => {
    await writeHtml(head("Cash, Secret", "Cash"));
    const data = await resolvePageData({ prisma }, { spaceId }, await htmlPage());
    if (!("sources" in data)) throw new Error("expected an html page");
    expect(data.sources.Cash?.history?.map((h) => h.value)).toEqual([{ balance: 2 }, { balance: 1 }]);
    expect(data.sources.Secret?.history).toBeUndefined();

    const big = await source(htmlId, "Big");
    const half = Math.floor(PAGE_HTML_DATA_MAX_BYTES / 4);
    for (let i = 0; i < 6; i++) await snap(big.id, { i, pad: "x".repeat(10) }, 100 - i, half);
    await writeHtml(head("Big", "Big"));
    const capped = await resolvePageData({ prisma }, { spaceId }, await htmlPage());
    if (!("sources" in capped)) throw new Error("expected an html page");
    const history = capped.sources.Big?.history ?? [];
    // The newest result and the newest history entries fit; the rest are dropped, oldest first.
    expect(history.length).toBeGreaterThan(0);
    expect(history.length).toBeLessThan(6);
    expect(history[0]?.value).toMatchObject({ i: 5 });
    expect(capped.sources.Big?.value).toMatchObject({ i: 5 });
  });

  it("leaves blocks page data in its original shape", async () => {
    const row = await prisma.botPage.findFirstOrThrow({ where: { id: blocksId } });
    const data = await resolvePageData({ prisma }, { spaceId }, row);
    expect(data).toEqual({ pageId: blocksId, revision: row.revision, blocks: [] });
  });
});
