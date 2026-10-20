import type { BotPage, PageAuthor, PageChart } from "@rakazo/contracts";
import { BOT_PAGE_MAX_CHARS, BOT_PAGE_MAX_CHARTS } from "@rakazo/contracts";
import { splitPage } from "@rakazo/core";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { isUniqueViolation } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { PlotSpec } from "./plot-tool.js";
import { renderPlotSpecToSvg } from "./plot-tool.js";

export interface PageDeps {
  prisma: PrismaClient;
  events: Pick<ThreadEvents, "append">;
}

export interface PageSaveInput {
  spaceId: string;
  botId: string;
  /** The bot's owner; the caller has already checked the bot belongs to this space and user. */
  userId: string;
  content: string;
  /** 0 creates the page. */
  baseRevision: number;
  updatedBy: PageAuthor;
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

async function newDocument(): Promise<Document> {
  // jsdom loads lazily so page-free runs never pay for it.
  const { JSDOM } = await import("jsdom");
  return new JSDOM("").window.document;
}

/** The one place chart rows and spec become an SVG; live chart sources will hook in here. */
function renderChart(chart: PageChart, document: Document): string {
  return renderPlotSpecToSvg(chart.spec as PlotSpec, chart.data, document);
}

/** Render one chart for display. A chart that fails to render yields a small error SVG. */
export async function renderPageChartSvg(chart: PageChart): Promise<string> {
  try {
    return renderChart(chart, await newDocument());
  } catch {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="40"><text x="8" y="24" font-family="system-ui, sans-serif" font-size="13" fill="currentColor">Chart could not be rendered</text></svg>';
  }
}

/** Throws PageValidationError unless every chart fence parses and renders with the PlotSpec rules. */
async function validatePageContent(content: string): Promise<void> {
  if (content.length > BOT_PAGE_MAX_CHARS) {
    throw new PageValidationError(
      `The page is ${content.length} characters; the limit is ${BOT_PAGE_MAX_CHARS}.`,
    );
  }
  const charts: PageChart[] = [];
  for (const segment of splitPage(content)) {
    if (segment.kind === "invalid_chart") {
      throw new PageValidationError(`Invalid chart block: ${segment.error}`);
    }
    if (segment.kind === "chart") charts.push(segment.chart);
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
  botId: string;
  content: string;
  revision: number;
  updatedBy: string;
  updatedAt: Date;
};

function toBotPage(row: PageRow): BotPage {
  return {
    botId: row.botId,
    content: row.content,
    revision: row.revision,
    updatedBy: row.updatedBy === "user" ? "user" : "bot",
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getBotPage(
  prisma: PrismaClient,
  scope: { spaceId: string; botId: string },
): Promise<BotPage | null> {
  const row = await prisma.botPage.findFirst({
    where: { botId: scope.botId, spaceId: scope.spaceId },
  });
  return row ? toBotPage(row) : null;
}

/**
 * Validate and save a bot's page, then announce it on the bot's thread. A stale baseRevision
 * writes nothing and returns the current page. Shared by the pages RPC and the page tools.
 */
export async function saveBotPage(deps: PageDeps, input: PageSaveInput): Promise<PageSaveResult> {
  await validatePageContent(input.content);
  const { prisma } = deps;
  const scope = { spaceId: input.spaceId, botId: input.botId };
  let saved: PageRow | null;
  try {
    saved = await prisma.$transaction(async (tx) => {
      const current = await tx.botPage.findFirst({ where: scope });
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
        page = await tx.botPage.create({
          data: {
            ...scope,
            userId: input.userId,
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
    // Two creates raced on the unique botId.
    if (!isUniqueViolation(error)) throw error;
    saved = null;
  }
  if (!saved) {
    return { ok: false, reason: "conflict", page: await getBotPage(prisma, scope) };
  }
  const thread = await prisma.thread.findFirst({
    where: { botId: input.botId, spaceId: input.spaceId },
    select: { id: true },
  });
  if (thread) {
    // The saved page is the source of truth; a missed event only delays a client refresh.
    await deps.events
      .append({
        spaceId: input.spaceId,
        threadId: thread.id,
        botId: input.botId,
        type: "page.updated",
        runId: input.sourceRunId,
        payload: { revision: saved.revision, updatedBy: input.updatedBy },
      })
      .catch((error) => {
        getLogger().warn("page.updated append failed", {
          error: error instanceof Error ? error.message : String(error),
          botId: input.botId,
        });
      });
  }
  return { ok: true, page: toBotPage(saved) };
}

export interface PageToolScope {
  spaceId: string;
  botId: string;
  userId: string;
  runId: string;
}

/** Run a page_* built-in tool. Scope comes from the run's bot, never from model input. */
export async function pageToolFromTool(
  name: "page_read" | "page_write" | "page_edit",
  deps: PageDeps,
  scope: PageToolScope,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await getBotPage(deps.prisma, scope);
  if (name === "page_read") {
    return { content: current?.content ?? "", revision: current?.revision ?? 0 };
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
      content,
      baseRevision,
      updatedBy: "bot",
      sourceRunId: scope.runId,
    });
    if (result.ok) return { ok: true, revision: result.page.revision };
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
