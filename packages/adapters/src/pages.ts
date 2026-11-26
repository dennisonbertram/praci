import type {
  BotPage,
  BotPageSummary,
  MessageBlock,
  PageAuthor,
  PageChart,
  PageKind,
} from "@rakazo/contracts";
import {
  BOT_PAGE_MAX_CHARS,
  BOT_PAGE_MAX_CHARTS,
  BOT_PAGE_MAX_PAGES,
  BOT_PAGE_TITLE_MAX,
  BotPageTitleSchema,
  PAGE_LIVE_BLOCKS_MAX,
  PageChartInputSchema,
} from "@rakazo/contracts";
import {
  gtmPageContentError,
  historyChartRows,
  htmlPageDeclaration,
  isLiveSegment,
  splitPage,
} from "@rakazo/core";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { addSidebarBotPage, isUniqueViolation } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { PlotSpec } from "./plot-tool.js";
import { renderPlotSpecToSvg, unknownPlotSpecKey } from "./plot-tool.js";

export interface PageDeps {
  prisma: PrismaClient;
  events: Pick<ThreadEvents, "append">;
}

export interface PageSaveInput {
  spaceId: string;
  botId: string;
  /** The bot's owner; the caller has already checked the bot belongs to this space and user. */
  userId: string;
  /** Without a pageId, the bot's first page; if it has none, baseRevision 0 creates it. */
  pageId?: string;
  content: string;
  /** 0 creates the page. */
  baseRevision: number;
  updatedBy: PageAuthor;
  gtmPage?: boolean;
  sourceRunId?: string;
}

export type PageSaveResult =
  | { ok: true; page: BotPage }
  | { ok: false; reason: "conflict"; page: BotPage | null };

/** The content is not a valid page. The message is written for the model or user to act on. */
export class PageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageValidationError";
  }
}

/** The title is taken by another page of the bot. Maps to a conflict. */
export class PageConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageConflictError";
  }
}

const FIRST_PAGE_ORDER = [{ createdAt: "asc" }, { id: "asc" }] as const;

async function newDocument(): Promise<Document> {
  // jsdom loads lazily so page-free runs never pay for it.
  const { JSDOM } = await import("jsdom");
  return new JSDOM("").window.document;
}

/** The one place chart rows and spec become an SVG. A sourced chart passes its resolved rows. */
function renderChart(chart: PageChart, document: Document, rows?: unknown[]): string {
  const plotted = rows ?? chart.data;
  return renderPlotSpecToSvg(
    chart.spec as PlotSpec,
    chart.over === "history" ? historyChartRows(plotted) : plotted,
    document,
  );
}

/** Render one chart for display. A chart that fails to render yields a small error SVG. */
export async function renderPageChartSvg(chart: PageChart, rows?: unknown[]): Promise<string> {
  try {
    return renderChart(chart, await newDocument(), rows);
  } catch {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="40"><text x="8" y="24" font-family="system-ui, sans-serif" font-size="13" fill="currentColor">Chart could not be rendered</text></svg>';
  }
}

/** Throws PageValidationError unless every chart fence parses and renders with the PlotSpec rules. */
async function validatePageContent(
  content: string,
  gtmPage = false,
  kind: PageKind = "blocks",
): Promise<void> {
  if (content.length > BOT_PAGE_MAX_CHARS) {
    throw new PageValidationError(
      `The page is ${content.length} characters; the limit is ${BOT_PAGE_MAX_CHARS}.`,
    );
  }
  if (kind === "html") {
    // No Markdown, chart or live-fence rules apply to an HTML document.
    const { error } = htmlPageDeclaration(content);
    if (error) throw new PageValidationError(error);
    return;
  }
  const gtmError = gtmPageContentError(content, gtmPage);
  if (gtmError) throw new PageValidationError(gtmError);
  const charts: PageChart[] = [];
  const segments = splitPage(content);
  for (const segment of segments) {
    if (segment.kind === "invalid_chart") {
      throw new PageValidationError(`Invalid chart block: ${segment.error}`);
    }
    if (segment.kind === "invalid_live") {
      throw new PageValidationError(`Invalid block: ${segment.error}`);
    }
    if (segment.kind === "chart") {
      const checked = PageChartInputSchema.safeParse(segment.chart);
      if (!checked.success) {
        throw new PageValidationError(`Invalid chart block: ${checked.error.issues[0]?.message}`);
      }
      const unknownKey = unknownPlotSpecKey(segment.chart.spec);
      if (unknownKey) {
        throw new PageValidationError(
          `Chart "${segment.chart.name}" has an unknown spec option "${unknownKey}". Use only title, data, width, height, margins, grid, inset, x, y, fx, fy, facet, color, r, opacity, symbol, length, projection, style and marks.`,
        );
      }
      charts.push(segment.chart);
    }
  }
  const liveBlocks = segments.filter(isLiveSegment).length;
  if (liveBlocks > PAGE_LIVE_BLOCKS_MAX) {
    throw new PageValidationError(
      `The page has ${liveBlocks} live blocks (metric, table and sourced charts); the limit is ${PAGE_LIVE_BLOCKS_MAX}.`,
    );
  }
  if (charts.length > BOT_PAGE_MAX_CHARTS) {
    throw new PageValidationError(
      `The page has ${charts.length} charts; the limit is ${BOT_PAGE_MAX_CHARTS}.`,
    );
  }
  if (charts.length === 0) return;
  const document = await newDocument();
  for (const chart of charts) {
    try {
      renderChart(chart, document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PageValidationError(`Chart "${chart.name}" is invalid: ${message}`);
    }
  }
}

type PageRow = {
  id: string;
  botId: string;
  title: string;
  content: string;
  kind: string;
  revision: number;
  updatedBy: string;
  updatedAt: Date;
};

function toBotPage(row: PageRow): BotPage {
  return {
    id: row.id,
    botId: row.botId,
    title: row.title,
    content: row.content,
    kind: row.kind === "html" ? "html" : "blocks",
    revision: row.revision,
    updatedBy: row.updatedBy === "user" ? "user" : "bot",
    updatedAt: row.updatedAt.toISOString(),
  };
}

type PageScope = { spaceId: string; botId: string; pageId?: string };

/** One page of the bot: the named one, or the first (oldest) when no pageId is given. */
export async function getBotPage(prisma: PrismaClient, scope: PageScope): Promise<BotPage | null> {
  const row = await prisma.botPage.findFirst({
    where: {
      botId: scope.botId,
      spaceId: scope.spaceId,
      ...(scope.pageId ? { id: scope.pageId } : {}),
    },
    orderBy: [...FIRST_PAGE_ORDER],
  });
  return row ? toBotPage(row) : null;
}

export async function listBotPages(
  prisma: PrismaClient,
  scope: { spaceId: string; botId: string },
): Promise<BotPageSummary[]> {
  const rows = await prisma.botPage.findMany({
    where: { botId: scope.botId, spaceId: scope.spaceId },
    select: { id: true, title: true, kind: true, revision: true, updatedAt: true },
    orderBy: [...FIRST_PAGE_ORDER],
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind === "html" ? ("html" as const) : ("blocks" as const),
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** The bot's page with this title (case-insensitive), or null. */
export async function findPageByTitle(
  prisma: PrismaClient,
  scope: { spaceId: string; botId: string },
  title: string,
): Promise<BotPageSummary | null> {
  const wanted = title.trim().toLowerCase();
  return (
    (await listBotPages(prisma, scope)).find((page) => page.title.toLowerCase() === wanted) ?? null
  );
}

function cleanTitle(title: string): string {
  const parsed = BotPageTitleSchema.safeParse(title);
  if (!parsed.success) {
    throw new PageValidationError(`A page title must be 1 to ${BOT_PAGE_TITLE_MAX} characters.`);
  }
  return parsed.data;
}

const duplicateTitle = (title: string) =>
  new PageConflictError(`A page named ${title} already exists`);

/** Create an empty page. Throws PageValidationError at the page cap, PageConflictError on a duplicate title. */
export async function createBotPage(
  deps: PageDeps,
  input: {
    spaceId: string;
    botId: string;
    userId: string;
    title: string;
    kind?: PageKind;
    sourceRunId?: string;
  },
): Promise<BotPage> {
  const title = cleanTitle(input.title);
  const { prisma } = deps;
  const scope = { spaceId: input.spaceId, botId: input.botId };
  let created: PageRow;
  try {
    created = await prisma.$transaction(async (tx) => {
      const existing = await tx.botPage.findMany({ where: scope, select: { title: true } });
      if (existing.length >= BOT_PAGE_MAX_PAGES) {
        throw new PageValidationError(`This bot already has ${BOT_PAGE_MAX_PAGES} pages`);
      }
      // Titles are matched case-insensitively (tools address pages by title), so they must differ that way too.
      if (existing.some((page) => page.title.toLowerCase() === title.toLowerCase())) {
        throw duplicateTitle(title);
      }
      const page = await tx.botPage.create({
        data: {
          ...scope,
          userId: input.userId,
          title,
          content: "",
          kind: input.kind ?? "blocks",
          revision: 1,
          updatedBy: "user",
        },
      });
      await tx.botPageRevision.create({
        data: { pageId: page.id, revision: 1, content: "", updatedBy: "user" },
      });
      return page;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateTitle(title);
    throw error;
  }
  await announce(deps, input, created, "user", input.sourceRunId);
  return toBotPage(created);
}

export async function renameBotPage(
  prisma: PrismaClient,
  input: { spaceId: string; botId: string; pageId: string; title: string },
): Promise<BotPageSummary | null> {
  const title = cleanTitle(input.title);
  const taken = await findPageByTitle(prisma, input, title);
  if (taken && taken.id !== input.pageId) throw duplicateTitle(title);
  try {
    const claimed = await prisma.botPage.updateMany({
      where: { id: input.pageId, botId: input.botId, spaceId: input.spaceId },
      data: { title },
    });
    if (claimed.count === 0) return null;
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateTitle(title);
    throw error;
  }
  const page = await getBotPage(prisma, { ...input });
  return page
    ? {
        id: page.id,
        title: page.title,
        kind: page.kind,
        revision: page.revision,
        updatedAt: page.updatedAt,
      }
    : null;
}

/** Ends every live share link of a page's snapshot artifacts; the artifacts themselves stay. */
export async function revokePageShares(
  db: Pick<PrismaClient, "artifactShare">,
  input: { spaceId: string; botId: string; pageId: string },
): Promise<void> {
  await db.artifactShare.updateMany({
    where: {
      spaceId: input.spaceId,
      revokedAt: null,
      artifact: { spaceId: input.spaceId, botId: input.botId, runId: `page-share:${input.pageId}` },
    },
    data: { revokedAt: new Date() },
  });
}

/**
 * Delete a page; its revisions go with it (cascade) and its public share links end.
 * False when the bot has no such page.
 */
export async function removeBotPage(
  prisma: PrismaClient,
  input: { spaceId: string; botId: string; pageId: string },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.botPage.deleteMany({
      where: { id: input.pageId, botId: input.botId, spaceId: input.spaceId },
    });
    if (removed.count === 0) return false;
    await revokePageShares(tx, input);
    return true;
  });
}

/** Tell the bot's thread a page's live data changed, so open pages reload it. */
export async function announcePageData(
  deps: PageDeps,
  input: { spaceId: string; botId: string; pageId: string },
): Promise<void> {
  const thread = await deps.prisma.thread.findFirst({
    where: { botId: input.botId, spaceId: input.spaceId },
    select: { id: true },
  });
  if (!thread) return;
  await deps.events
    .append({
      spaceId: input.spaceId,
      threadId: thread.id,
      botId: input.botId,
      type: "page.data",
      payload: { pageId: input.pageId },
    })
    .catch((error) => {
      getLogger().warn("page.data append failed", {
        error: error instanceof Error ? error.message : String(error),
        botId: input.botId,
      });
    });
}

/** Tell the bot's thread a page changed. The saved page is the source of truth; a missed event only delays a refresh. */
async function announce(
  deps: PageDeps,
  input: { spaceId: string; botId: string },
  page: { id: string; revision: number },
  updatedBy: PageAuthor,
  runId?: string,
): Promise<void> {
  const thread = await deps.prisma.thread.findFirst({
    where: { botId: input.botId, spaceId: input.spaceId },
    select: { id: true },
  });
  if (!thread) return;
  await deps.events
    .append({
      spaceId: input.spaceId,
      threadId: thread.id,
      botId: input.botId,
      type: "page.updated",
      runId,
      payload: { pageId: page.id, revision: page.revision, updatedBy },
    })
    .catch((error) => {
      getLogger().warn("page.updated append failed", {
        error: error instanceof Error ? error.message : String(error),
        botId: input.botId,
      });
    });
}

/**
 * Validate and save a bot's page, then announce it on the bot's thread. A stale baseRevision
 * writes nothing and returns the current page. Shared by the pages RPC and the page tools.
 */
export async function saveBotPage(deps: PageDeps, input: PageSaveInput): Promise<PageSaveResult> {
  const { prisma } = deps;
  const scope = { spaceId: input.spaceId, botId: input.botId };
  // The kind is fixed when a page is created; a save to a page that does not exist yet is a blocks page.
  const existing = await prisma.botPage.findFirst({
    where: { ...scope, ...(input.pageId ? { id: input.pageId } : {}) },
    orderBy: [...FIRST_PAGE_ORDER],
    select: { kind: true },
  });
  await validatePageContent(
    input.content,
    input.gtmPage ?? false,
    existing?.kind === "html" ? "html" : "blocks",
  );
  let saved: PageRow | null;
  try {
    saved = await prisma.$transaction(async (tx) => {
      const current = await tx.botPage.findFirst({
        where: { ...scope, ...(input.pageId ? { id: input.pageId } : {}) },
        orderBy: [...FIRST_PAGE_ORDER],
      });
      // A named page that is gone cannot be created by a save.
      if (!current && input.pageId) return null;
      if ((current?.revision ?? 0) !== input.baseRevision) return null;
      const revision = input.baseRevision + 1;
      let page: PageRow & { id: string };
      if (current) {
        // The revision in the where clause makes a concurrent save lose instead of overwrite.
        const claimed = await tx.botPage.updateMany({
          where: { id: current.id, revision: current.revision },
          data: { content: input.content, revision, updatedBy: input.updatedBy },
        });
        if (claimed.count === 0) return null;
        page = {
          ...current,
          content: input.content,
          revision,
          updatedBy: input.updatedBy,
          updatedAt: new Date(),
        };
      } else {
        const bot = await tx.bot.findFirst({ where: { id: input.botId }, select: { name: true } });
        page = await tx.botPage.create({
          data: {
            ...scope,
            userId: input.userId,
            title: bot?.name.trim().slice(0, BOT_PAGE_TITLE_MAX).trim() || "Page",
            content: input.content,
            revision,
            updatedBy: input.updatedBy,
          },
        });
      }
      await tx.botPageRevision.create({
        data: {
          pageId: page.id,
          revision,
          content: input.content,
          updatedBy: input.updatedBy,
          sourceRunId: input.sourceRunId,
        },
      });
      return page;
    });
  } catch (error) {
    // Two creates raced on the same first-page title.
    if (!isUniqueViolation(error)) throw error;
    saved = null;
  }
  if (!saved) {
    return {
      ok: false,
      reason: "conflict",
      page: await getBotPage(prisma, { ...scope, pageId: input.pageId }),
    };
  }
  await announce(deps, input, saved, input.updatedBy, input.sourceRunId);
  return { ok: true, page: toBotPage(saved) };
}

export interface PageToolScope {
  spaceId: string;
  botId: string;
  userId: string;
  runId: string;
  gtmPage?: boolean;
}

const NO_SUCH_PAGE = (title: string) =>
  `There is no page titled "${title}". Call page_list to see the pages, or page_create to add one.`;

/** Run a page_* built-in tool. Scope comes from the run's bot, never from model input. */
export async function pageToolFromTool(
  name: "page_list" | "page_create" | "page_read" | "page_write" | "page_edit",
  deps: PageDeps,
  scope: PageToolScope,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (name === "page_list") {
    const pages = await listBotPages(deps.prisma, scope);
    return { pages: pages.map((page) => ({ ...page, link: botPageLink(scope.botId, page.id) })) };
  }
  if (name === "page_create") {
    try {
      const page = await createBotPage(deps, {
        spaceId: scope.spaceId,
        botId: scope.botId,
        userId: scope.userId,
        title: String(args.title ?? ""),
        kind: args.kind === "html" ? "html" : "blocks",
        sourceRunId: scope.runId,
      });
      // An agent's new page goes in its owner's sidebar. Adding is idempotent, the owner can remove
      // it, and a failure here must not undo the page.
      await addSidebarBotPage(
        deps.prisma,
        { spaceId: scope.spaceId, userId: scope.userId },
        page.id,
      ).catch((error) =>
        getLogger().warn("sidebar add for created page failed", {
          error: error instanceof Error ? error.message : String(error),
          botId: scope.botId,
        }),
      );
      return {
        ok: true,
        pageId: page.id,
        link: botPageLink(scope.botId, page.id),
        title: page.title,
        kind: page.kind,
        revision: page.revision,
      };
    } catch (error) {
      if (error instanceof PageValidationError || error instanceof PageConflictError) {
        return { error: error.message };
      }
      throw error;
    }
  }
  let pageId: string | undefined;
  const wantedTitle = typeof args.page === "string" ? args.page.trim() : "";
  if (wantedTitle) {
    const found = await findPageByTitle(deps.prisma, scope, wantedTitle);
    if (!found) return { error: NO_SUCH_PAGE(wantedTitle) };
    pageId = found.id;
  }
  const current = await getBotPage(deps.prisma, { ...scope, pageId });
  if (name === "page_read") {
    return {
      content: current?.content ?? "",
      revision: current?.revision ?? 0,
      ...(current ? { title: current.title, link: botPageLink(scope.botId, current.id) } : {}),
    };
  }
  const baseRevision = Number(args.baseRevision);
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    return { error: "baseRevision must be the revision from page_read (0 for a new page)." };
  }
  let content: string;
  if (name === "page_write") {
    content = String(args.content ?? "");
  } else {
    const oldString = String(args.old_string ?? "");
    const text = current?.content ?? "";
    const occurrences = oldString ? text.split(oldString).length - 1 : 0;
    if (occurrences !== 1) {
      return {
        error: `old_string must appear exactly once in the page; it appears ${occurrences} times. Call page_read and copy the exact text.`,
      };
    }
    content = text.replace(oldString, () => String(args.new_string ?? ""));
  }
  try {
    const result = await saveBotPage(deps, {
      ...scope,
      pageId,
      content,
      baseRevision,
      updatedBy: "bot",
      sourceRunId: scope.runId,
    });
    if (result.ok) {
      return {
        ok: true,
        revision: result.page.revision,
        link: botPageLink(scope.botId, result.page.id),
      };
    }
    return {
      error:
        "The page changed since you read it. Nothing was saved; reapply your change to the current content.",
      content: result.page?.content ?? "",
      revision: result.page?.revision ?? 0,
    };
  } catch (error) {
    if (error instanceof PageValidationError) return { error: error.message };
    throw error;
  }
}

/**
 * The page text before and after a page_write or page_edit would save, for the outbound check of a
 * Firewall agent. Null when the target page or the edit cannot be resolved (the tool would fail).
 */
export async function previewPageWrite(
  deps: { prisma: PrismaClient },
  scope: { spaceId: string; botId: string; userId: string },
  name: "page_write" | "page_edit",
  args: Record<string, unknown>,
): Promise<{ original: string; result: string; kind: "blocks" | "html"; revision: number } | null> {
  const wantedTitle = typeof args.page === "string" ? args.page.trim() : "";
  let pageId: string | undefined;
  if (wantedTitle) {
    const found = await findPageByTitle(deps.prisma, scope, wantedTitle);
    if (!found) return null;
    pageId = found.id;
  }
  const page = await getBotPage(deps.prisma, { ...scope, pageId });
  if (!page) return null;
  const original = page.content;
  if (name === "page_write")
    return {
      original,
      result: String(args.content ?? ""),
      kind: page.kind,
      revision: page.revision,
    };
  const oldString = String(args.old_string ?? "");
  if (!oldString || original.split(oldString).length - 1 !== 1) return null;
  return {
    original,
    result: original.replace(oldString, () => String(args.new_string ?? "")),
    kind: page.kind,
    revision: page.revision,
  };
}

/** The in-app path of a bot page. Chat renders a Markdown link to it as in-app navigation. */
export const botPageLink = (botId: string, pageId: string) =>
  `/app/pages/${encodeURIComponent(botId)}/${encodeURIComponent(pageId)}`;

/** The chat card for a page the agent just created; null for every other page tool call or a failed create. */
export function pageCardBlock(
  toolName: string,
  scope: { botId: string },
  result: Record<string, unknown>,
): MessageBlock | null {
  if (toolName !== "page_create" || result.ok !== true || typeof result.pageId !== "string") {
    return null;
  }
  return { kind: "page", botId: scope.botId, pageId: result.pageId, title: String(result.title) };
}
